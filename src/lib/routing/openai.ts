import OpenAI from "openai";
import type { Priority } from "@prisma/client";
import type { RoutingInput, RoutingProvider, RoutingResult } from "./types";

const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export interface OpenAICompatibleOptions {
  /** Display/provider name recorded on each RoutingDecision (e.g. "gemini"). */
  name: string;
  apiKey: string;
  model: string;
  /** Override base URL for OpenAI-compatible providers (Gemini, Grok). */
  baseURL?: string;
}

/**
 * Classifier for any OpenAI-compatible chat API (OpenAI, Gemini via its
 * OpenAI-compatible endpoint, or Grok/xAI). Uses JSON-schema structured output
 * so the model is constrained to return exactly the fields we need; the result
 * is then validated against the allowed categories/priorities.
 */
export class OpenAICompatibleRoutingProvider implements RoutingProvider {
  readonly name: string;
  private client: OpenAI;
  private model: string;

  constructor(opts: OpenAICompatibleOptions) {
    this.name = opts.name;
    this.model = opts.model;
    this.client = new OpenAI({ apiKey: opts.apiKey, baseURL: opts.baseURL });
  }

  async route(input: RoutingInput): Promise<RoutingResult> {
    const categoryNames = input.categories.map((c) => c.name);

    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "You are a support triage assistant. Classify the incoming issue into one of the " +
            "allowed categories, assign a priority, and report your confidence (0-1). " +
            "Be conservative with confidence when the issue is ambiguous.",
        },
        {
          role: "user",
          content: JSON.stringify({
            title: input.title,
            description: input.description,
            allowedCategories: categoryNames,
          }),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "routing_decision",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              category: { type: "string", enum: categoryNames },
              priority: { type: "string", enum: PRIORITIES },
              confidence: { type: "number" },
              rationale: { type: "string" },
            },
            required: ["category", "priority", "confidence", "rationale"],
          },
        },
      },
    });

    const raw = completion.choices[0]?.message.content ?? "{}";
    const parsed = JSON.parse(raw) as {
      category: string;
      priority: Priority;
      confidence: number;
      rationale: string;
    };

    const category = input.categories.find((c) => c.name === parsed.category) ?? null;
    const priority = PRIORITIES.includes(parsed.priority) ? parsed.priority : "MEDIUM";
    const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));

    return {
      suggestedCategoryId: category?.id ?? null,
      suggestedPriority: priority,
      suggestedTeamId: null,
      confidence,
      rationale: parsed.rationale ?? "",
      provider: this.name,
      model: this.model,
      tokensUsed: completion.usage?.total_tokens,
    };
  }
}
