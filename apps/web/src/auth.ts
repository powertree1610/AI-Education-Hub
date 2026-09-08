import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { schema as s } from "@platform/db";
import { writeAudit } from "@platform/shared";
import { getDb } from "@/lib/db";

/**
 * Self-hosted credentials auth via Auth.js (NextAuth v5).
 * The identifier is an email (staff/guardians) OR a username (students, who
 * are 7-12 and have no email — v5). Passwords are bcrypt hashes in
 * core.users.password_hash (migration 0003); a NULL hash means the row
 * cannot sign in. Sessions are signed JWT cookies (AUTH_SECRET).
 */

// Simple in-process lockout: 5 failed attempts per identifier → 5 min.
// Once the lock expires the counter resets, so the user gets a fresh 5 tries.
const attempts = new Map<string, { fails: number; lockedUntil: number }>();
const MAX_FAILS = 5;
const LOCK_MS = 5 * 60 * 1000;

function isLocked(identifier: string): boolean {
  const entry = attempts.get(identifier);
  if (!entry || entry.fails < MAX_FAILS) return false;
  if (Date.now() >= entry.lockedUntil) {
    attempts.delete(identifier); // lock expired — start over
    return false;
  }
  return true;
}

function recordFail(identifier: string): void {
  const entry = attempts.get(identifier) ?? { fails: 0, lockedUntil: 0 };
  entry.fails += 1;
  if (entry.fails >= MAX_FAILS) entry.lockedUntil = Date.now() + LOCK_MS;
  attempts.set(identifier, entry);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true, // behind IIS ARR reverse proxy
  session: { strategy: "jwt", maxAge: 12 * 60 * 60 },
  pages: { signIn: "/sign-in" },
  providers: [
    Credentials({
      credentials: { identifier: {}, password: {} },
      authorize: async (credentials) => {
        const identifier = String(credentials?.identifier ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!identifier || !password) return null;

        const db = getDb();
        if (isLocked(identifier)) {
          await writeAudit(db, {
            actorType: "system",
            action: "login_locked",
            entityType: "user",
            details: { identifier },
          });
          return null;
        }

        // '@' → email (staff/guardians, citext); otherwise username (students).
        const identifierMatch = identifier.includes("@")
          ? eq(s.users.email, identifier)
          : sql`lower(${s.users.username}) = ${identifier}`;
        const user = (
          await db
            .select()
            .from(s.users)
            .where(and(identifierMatch, eq(s.users.isActive, true), isNotNull(s.users.passwordHash)))
            .limit(1)
        )[0];

        const ok = user?.passwordHash ? await bcrypt.compare(password, user.passwordHash) : false;
        if (!ok || !user) {
          recordFail(identifier);
          await writeAudit(db, {
            actorType: "system",
            action: "login_failed",
            entityType: "user",
            entityId: user?.id ?? null,
            details: { identifier },
          });
          return null;
        }

        attempts.delete(identifier);
        await writeAudit(db, {
          actorType: "user",
          actorId: user.id,
          action: "login_success",
          entityType: "user",
          entityId: user.id,
        });
        // Students have no email — Auth.js tolerates undefined here; session
        // resolution is by id in lib/auth.ts regardless.
        return { id: user.id, email: user.email ?? undefined, name: user.name };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) (session.user as { id?: string }).id = token.sub;
      return session;
    },
  },
});
