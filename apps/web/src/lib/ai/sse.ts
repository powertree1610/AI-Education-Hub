import "server-only";

/** Shared SSE plumbing for the chat routes. One copy on purpose: the
 *  IIS/ARR deployment depends on these exact headers (no-transform keeps
 *  the reverse proxy from buffering the stream) — see DEPLOYMENT.md. */

export const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
} as const;

export function sseEncode(payload: Record<string, unknown>): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

/** A complete, immediately-closed SSE response (e.g. safety deflections). */
export function sseOnce(events: Record<string, unknown>[]): Response {
  return new Response(events.map(sseEncode).join(""), { headers: SSE_HEADERS });
}
