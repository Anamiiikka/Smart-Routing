import pino from "pino";

// Structured logging. Pretty-prints in dev, JSON in production for log
// aggregators. Use child loggers (e.g. logger.child({ module: "routing" }))
// to tag log lines by subsystem.
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  ...(process.env.NODE_ENV === "development"
    ? { transport: { target: "pino-pretty", options: { colorize: true } } }
    : {}),
});
