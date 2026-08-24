import "server-only";
import type { ChatMessage } from "./ai/central-api";

/**
 * Running kiosk conversation state, in memory per session. This is transient
 * processing context, NOT storage — the transcript is only ever persisted at
 * session end, and only when conversation_storage consent is granted then.
 * (A dev-server restart drops the running context; acceptable in v1.)
 */
const globalForKiosk = globalThis as unknown as {
  __kioskTranscripts?: Map<string, ChatMessage[]>;
};

export function kioskHistory(sessionId: string): ChatMessage[] {
  if (!globalForKiosk.__kioskTranscripts) globalForKiosk.__kioskTranscripts = new Map();
  let history = globalForKiosk.__kioskTranscripts.get(sessionId);
  if (!history) {
    history = [];
    globalForKiosk.__kioskTranscripts.set(sessionId, history);
  }
  return history;
}

export function clearKioskHistory(sessionId: string): void {
  globalForKiosk.__kioskTranscripts?.delete(sessionId);
}
