import { ChatIndex } from "@/components/chat-index";
import { requireRoleOrRedirect } from "@/lib/guard";

export const dynamic = "force-dynamic";

/** Same chat, admin shell — so admins never lose their own navigation. */
export default async function AdminChatIndexPage() {
  const user = await requireRoleOrRedirect("admin");
  return <ChatIndex user={user} basePath="/admin/chat" />;
}
