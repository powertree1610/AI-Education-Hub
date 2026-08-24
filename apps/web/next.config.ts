import type { NextConfig } from "next";

import path from "node:path";
import { config as loadEnv } from "dotenv";

// Dev convenience: .env lives at the repo root. In production (IIS/WinSW),
// env vars come from the service configuration instead — standalone server.js
// does not execute this file's side effects.
loadEnv({ path: path.resolve(__dirname, "../../.env") });

const nextConfig: NextConfig = {
  // Windows Server IIS deployment: standalone server behind ARR reverse proxy.
  output: "standalone",
  outputFileTracingRoot: path.resolve(__dirname, "../.."),
  transpilePackages: ["@platform/db", "@platform/shared"],
  serverExternalPackages: ["pg"],
  webpack: (config) => {
    // Workspace packages use NodeNext ESM imports ("./client.js" → client.ts).
    config.resolve.extensionAlias = { ".js": [".ts", ".tsx", ".js"] };
    return config;
  },
};

export default nextConfig;
