import { config } from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Dev: .env at the repo root. Production (Windows service): real env vars —
// dotenv never overrides variables that are already set.
//
// Walk upwards from this file rather than hard-coding a depth: the source
// lives at src/lib/, the production bundle at dist/, and both must find the
// same repo-root .env.
const here = path.dirname(fileURLToPath(import.meta.url));
let dir = here;
for (let i = 0; i < 6; i++) {
  const candidate = path.join(dir, ".env");
  if (fs.existsSync(candidate)) {
    config({ path: candidate });
    break;
  }
  const parent = path.dirname(dir);
  if (parent === dir) break;
  dir = parent;
}

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v;
}
