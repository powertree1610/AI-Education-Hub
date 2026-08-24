/** Central env access for apps/web. Fail fast on truly required vars. */

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v;
}

/**
 * Auth mode: Clerk when keys are configured, otherwise a dev-only fallback
 * (cookie-selected seeded user via /dev-login). Production must use Clerk.
 */
export function authMode(): "clerk" | "dev" {
  return process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY
    ? "clerk"
    : "dev";
}
