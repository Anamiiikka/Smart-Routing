import { z } from "zod";

/**
 * Validates environment variables once at startup. Import `env` anywhere on the
 * server instead of reading `process.env` directly, so a missing/invalid var
 * fails fast with a clear message rather than surfacing as a runtime null.
 */
const schema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),
  AUTH_SECRET: z.string().min(1),
  AUTH_TRUST_HOST: z.string().optional(),
  LLM_PROVIDER: z.enum(["openai", "gemini", "grok", "mock"]).default("mock"),
  OPENAI_API_KEY: z.string().optional().default(""),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  GEMINI_API_KEY: z.string().optional().default(""),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  XAI_API_KEY: z.string().optional().default(""),
  XAI_MODEL: z.string().default("grok-2-latest"),
  ROUTING_CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.7),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.string().default("info"),
});

function loadEnv() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  // Note: a missing API key for the active LLM provider is NOT fatal — the
  // routing provider factory falls back to the deterministic mock and logs a
  // warning, so the app and CI keep working without a key.
  return parsed.data;
}

export const env = loadEnv();
export type Env = typeof env;
