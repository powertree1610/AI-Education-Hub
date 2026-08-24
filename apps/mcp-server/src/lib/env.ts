import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Dev: .env at the repo root. Production (Windows service): real env vars.
const here = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(here, "../../../../.env") });

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v;
}
