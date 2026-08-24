import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { and, eq, isNotNull } from "drizzle-orm";
import { schema as s } from "@platform/db";
import { writeAudit } from "@platform/shared";
import { getDb } from "@/lib/db";

/**
 * Self-hosted credentials auth via Auth.js (NextAuth v5).
 * Passwords are bcrypt hashes in core.users.password_hash (migration 0003);
 * a NULL hash means the row cannot sign in (students, not-yet-onboarded staff).
 * Sessions are signed JWT cookies (AUTH_SECRET) — nothing stored server-side.
 */

// Simple in-process lockout: 5 failed attempts per email → 15 min.
const attempts = new Map<string, { fails: number; lockedUntil: number }>();
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

function isLocked(email: string): boolean {
  const entry = attempts.get(email);
  return !!entry && entry.fails >= MAX_FAILS && Date.now() < entry.lockedUntil;
}

function recordFail(email: string): void {
  const entry = attempts.get(email) ?? { fails: 0, lockedUntil: 0 };
  entry.fails += 1;
  entry.lockedUntil = Date.now() + LOCK_MS;
  attempts.set(email, entry);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true, // behind IIS ARR reverse proxy
  session: { strategy: "jwt", maxAge: 12 * 60 * 60 },
  pages: { signIn: "/sign-in" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        const db = getDb();
        if (isLocked(email)) {
          await writeAudit(db, {
            actorType: "system",
            action: "login_locked",
            entityType: "user",
            details: { email },
          });
          return null;
        }

        const user = (
          await db
            .select()
            .from(s.users)
            .where(
              and(eq(s.users.email, email), eq(s.users.isActive, true), isNotNull(s.users.passwordHash)),
            )
            .limit(1)
        )[0];

        const ok = user?.passwordHash ? await bcrypt.compare(password, user.passwordHash) : false;
        if (!ok || !user) {
          recordFail(email);
          await writeAudit(db, {
            actorType: "system",
            action: "login_failed",
            entityType: "user",
            entityId: user?.id ?? null,
            details: { email },
          });
          return null;
        }

        attempts.delete(email);
        await writeAudit(db, {
          actorType: "user",
          actorId: user.id,
          action: "login_success",
          entityType: "user",
          entityId: user.id,
        });
        return { id: user.id, email: user.email, name: user.name };
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
