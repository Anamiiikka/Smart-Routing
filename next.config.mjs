import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["pg-boss", "pino"],
  // Pin the file-tracing root to this project (a lockfile exists in the parent
  // dir, which would otherwise be inferred as the workspace root).
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
