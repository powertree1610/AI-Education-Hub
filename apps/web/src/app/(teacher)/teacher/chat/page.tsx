import { ChatIndex } from "@/components/chat-index";
import { requireRoleOrRedirect } from "@/lib/guard";

export const dynamic = "force-dynamic";

export default async function TeacherChatIndexPage() {
  const user = await requireRoleOrRedirect("teacher", "admin");
  return <ChatIndex user={user} basePath="/teacher/chat" />;
}
