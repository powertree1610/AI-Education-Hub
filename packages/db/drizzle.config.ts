import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";
import path from "node:path";

// .env lives at the repo root, not in this package. (cwd is packages/db —
// drizzle-kit compiles this config to CJS, so import.meta.dirname is unusable.)
config({ path: path.resolve(process.cwd(), "../../.env") });

// Introspection-only config. The live Neon DB is the PM-approved source of
// truth; we PULL from it and never push/generate DDL against approved tables.
// The only DDL this repo owns is migrations/0001_agent_chats.sql (additive).
export default defineConfig({
  dialect: "postgresql",
  out: "./src/schema",
  schemaFilter: ["core"],
  dbCredentials: {
    // Direct (non-pooled) endpoint; owner role.
    url: process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL ?? "",
  },
});
