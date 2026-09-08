import { NextRequest } from "next/server";
import { handleSessionChat } from "@/lib/ai/session-chat";

export const dynamic = "force-dynamic";

/** Home Mode: the student's own self-serve session. */
export async function POST(req: NextRequest) {
  return handleSessionChat(req, "student");
}
