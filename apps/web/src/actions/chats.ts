"use server";

import { redirect } from "next/navigation";
import { schema as s } from "@platform/db";
import { requireAppUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function createChatAction(formData: FormData) {
  const user = await requireAppUser("teacher", "admin");
  const db = getDb();
  const studentId = String(formData.get("studentId") ?? "") || null;
  const basePath = formData.get("basePath") === "/admin/chat" ? "/admin/chat" : "/teacher/chat";

  const [chat] = await db
    .insert(s.agentChats)
    .values({ userId: user.id, studentId, title: null })
    .returning({ id: s.agentChats.id });

  redirect(`${basePath}/${chat!.id}`);
}
