import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

// .env lives at the repo root; scripts run with cwd = packages/db.
const here = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(here, "../../../.env") });
config({ path: path.resolve(here, "../../.env") }); // fallback if layout changes

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name} (set it in the repo-root .env)`);
  return v;
}
