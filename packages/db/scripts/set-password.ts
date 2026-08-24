/**
 * Bootstrap/recovery: set a user's password directly (owner role), e.g. the
 * first admin before anyone can sign in, or an ops reset.
 *
 *   pnpm --filter @platform/db exec tsx scripts/set-password.ts <email> <password>
 */
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { createDb } from "../src/client.js";
import * as s from "../src/schema/index.js";
import { requireEnv } from "./env.js";

const [email, password] = [process.argv[2], process.argv[3]];
if (!email || !password || password.length < 8) {
  console.error("usage: tsx scripts/set-password.ts <email> <password(min 8 chars)>");
  process.exit(1);
}

const { db, pool } = createDb({ connectionString: requireEnv("DATABASE_URL") });

async function main() {
  const hash = await bcrypt.hash(password!, 10);
  const rows = await db
    .update(s.users)
    .set({ passwordHash: hash })
    .where(eq(s.users.email, email!.toLowerCase()))
    .returning({ id: s.users.id, name: s.users.name, role: s.users.role });
  if (!rows[0]) {
    console.error(`No user with email ${email}`);
    process.exitCode = 1;
    return;
  }
  console.log(`password set for ${rows[0].name} (${rows[0].role})`);
}

main()
  .catch((err) => {
    console.error("failed:", err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
