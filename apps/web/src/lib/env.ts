/** Central env access for apps/web. Fail fast on truly required vars. */

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v;
}

/**
 * Auth mode, by configuration:
 *  - "clerk": Clerk keys configured (dormant option, kept for a future HQ setup)
 *  - "local": AUTH_SECRET configured — self-hosted Auth.js credentials
 *             (email + bcrypt password_hash in core.users). Production default.
 *  - "dev":   nothing configured — cookie-selected seeded user via /dev-login.
 */
export function authMode(): "clerk" | "local" | "dev" {
  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY) return "clerk";
  if (process.env.AUTH_SECRET) return "local";
  return "dev";
}
