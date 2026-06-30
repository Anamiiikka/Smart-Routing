import type { Priority } from "@prisma/client";
import type { RoutingInput, RoutingProvider, RoutingResult } from "./types";

/**
 * Deterministic, keyless classifier used for development, tests, and CI. Uses
 * simple keyword heuristics so behaviour is reproducible without an API call.
 */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Billing: ["charge", "charged", "invoice", "refund", "billing", "payment", "subscription"],
  Bug: ["error", "500", "crash", "broken", "bug", "exception", "fails", "failing", "500 error"],
  "Account Access": ["login", "password", "locked", "access", "mfa", "2fa", "sign in", "account"],
  "How-to / Question": ["how", "question", "export", "where", "can i", "guide", "documentation"],
  "Feature Request": ["feature", "add", "would love", "request", "suggestion", "wish", "dark mode"],
};

const URGENT_KEYWORDS = ["urgent", "locked out", "double charged", "cannot access", "can't access", "down", "outage", "asap", "immediately"];
const HIGH_KEYWORDS = ["error", "500", "crash", "failing", "broken", "blocked"];
const LOW_KEYWORDS = ["how", "question", "feature", "would love", "documentation", "suggestion"];

function scoreCategory(text: string, keywords: string[]): number {
  return keywords.reduce((n, kw) => (text.includes(kw) ? n + 1 : n), 0);
}

function pickPriority(text: string): Priority {
  if (URGENT_KEYWORDS.some((k) => text.includes(k))) return "URGENT";
  if (HIGH_KEYWORDS.some((k) => text.includes(k))) return "HIGH";
  if (LOW_KEYWORDS.some((k) => text.includes(k))) return "LOW";
  return "MEDIUM";
}

export class MockRoutingProvider implements RoutingProvider {
  readonly name = "mock";

  async route(input: RoutingInput): Promise<RoutingResult> {
    const text = `${input.title} ${input.description}`.toLowerCase();

    // Score each available category by keyword hits.
    let bestName: string | null = null;
    let bestScore = 0;
    for (const cat of input.categories) {
      const keywords = CATEGORY_KEYWORDS[cat.name] ?? [cat.name.toLowerCase()];
      const score = scoreCategory(text, keywords);
      if (score > bestScore) {
        bestScore = score;
        bestName = cat.name;
      }
    }

    const category = input.categories.find((c) => c.name === bestName) ?? null;
    const priority = pickPriority(text);

    // Confidence scales with how decisively one category won.
    const confidence = bestScore === 0 ? 0.3 : Math.min(0.95, 0.55 + bestScore * 0.15);

    return {
      suggestedCategoryId: category?.id ?? null,
      suggestedPriority: priority,
      suggestedTeamId: null, // resolved by the caller from the category's default team
      confidence,
      rationale:
        bestName != null
          ? `Matched ${bestScore} keyword(s) for "${bestName}"; priority inferred as ${priority}.`
          : `No strong category match; defaulting priority to ${priority}.`,
      provider: this.name,
      model: "keyword-heuristic-v1",
    };
  }
}
