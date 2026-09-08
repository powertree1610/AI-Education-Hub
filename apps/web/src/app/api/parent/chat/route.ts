import { NextRequest } from "next/server";
import { handleSessionChat } from "@/lib/ai/session-chat";

/** Parent AI chat (v6) — third surface of the shared session-chat handler. */
export async function POST(req: NextRequest): Promise<Response> {
  return handleSessionChat(req, "parent");
}
