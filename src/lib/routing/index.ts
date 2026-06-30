import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { MockRoutingProvider } from "./mock";
import { OpenAICompatibleRoutingProvider } from "./openai";
import type { RoutingProvider } from "./types";

const log = logger.child({ module: "routing" });

let cached: RoutingProvider | null = null;

/** Per-provider connection config for the OpenAI-compatible providers. */
function providerConfig(): { name: string; apiKey: string; model: string; baseURL?: string } | null {
  switch (env.LLM_PROVIDER) {
    case "openai":
      return { name: "openai", apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL };
    case "gemini":
      return {
        name: "gemini",
        apiKey: env.GEMINI_API_KEY,
        model: env.GEMINI_MODEL,
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      };
    case "grok":
      return {
        name: "grok",
        apiKey: env.XAI_API_KEY,
        model: env.XAI_MODEL,
        baseURL: "https://api.x.ai/v1",
      };
    default:
      return null; // "mock"
  }
}

/**
 * Returns the configured routing provider (singleton). Falls back to the
 * deterministic mock if the selected provider has no API key, so the app and
 * CI keep working keyless.
 */
export function getRoutingProvider(): RoutingProvider {
  if (cached) return cached;

  const config = providerConfig();
  if (config && !config.apiKey) {
    log.warn(
      { provider: config.name },
      "No API key for the selected LLM provider; falling back to the mock provider",
    );
  }

  cached =
    config && config.apiKey
      ? new OpenAICompatibleRoutingProvider(config)
      : new MockRoutingProvider();

  log.info({ provider: cached.name }, "Routing provider initialised");
  return cached;
}

export * from "./types";
