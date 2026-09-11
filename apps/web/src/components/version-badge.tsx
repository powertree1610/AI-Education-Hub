import { APP_VERSION } from "@/lib/version";

/**
 * Fixed bottom-left version tag, rendered once from the root layout so it
 * appears on every screen (portals, kiosk, sign-in). pointer-events-none so
 * it never intercepts taps on kiosk/touch layouts.
 */
export function VersionBadge() {
  return (
    <div
      aria-label={`Application version ${APP_VERSION}`}
      className="pointer-events-none fixed bottom-1.5 left-2 z-50 select-none rounded px-1.5 py-0.5 font-mono text-[11px] leading-none text-[var(--ink)]/45 print:hidden"
    >
      {`v${APP_VERSION}`}
    </div>
  );
}
