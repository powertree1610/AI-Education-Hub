import { ChatSession } from "@/components/chat-session";
import { requireRoleOrRedirect } from "@/lib/guard";

export const dynamic = "force-dynamic";

export default async function AdminChatPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const user = await requireRoleOrRedirect("admin");
  const { chatId } = await params;
  return <ChatSession user={user} chatId={chatId} />;
}
