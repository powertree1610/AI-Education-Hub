import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { schema as s } from "@platform/db";
import { parseLocalUrl } from "@platform/shared";
import { endStudentSessionAction } from "@/actions/student-sessions";
import { ChatWindow } from "@/components/chat-window";
import { getDb } from "@/lib/db";
import { requireRoleOrRedirect } from "@/lib/guard";
import { studentForUser } from "@/lib/student";

export const dynamic = "force-dynamic";

/** Home Mode chat — the student's own active session (Talk or Learn). */
export default async function StudentChatPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const user = await requireRoleOrRedirect("student");
  const student = await studentForUser(user.id);
  if (!student) notFound();

  const { sessionId } = await params;
  const db = getDb();
  const session = (
    await db
      .select()
      .from(s.aiSessions)
      .where(and(eq(s.aiSessions.id, sessionId), eq(s.aiSessions.status, "active")))
      .limit(1)
  )[0];
  if (!session || session.startedBy !== user.id || session.studentId !== student.id) notFound();

  const daily = session.sessionKind === "daily";
  const started = new Date(session.startedAt).getTime();
  const minutes = student.maxSessionMinutes ?? 45;
  const minutesLeft = Math.max(0, Math.round(minutes - (Date.now() - started) / 60_000));

  // Learning Workspace (v6): a Learn session anchored to a teacher-set task.
  const material = session.materialId
    ? (
        await db
          .select()
          .from(s.teachingMaterials)
          .where(eq(s.teachingMaterials.id, session.materialId))
          .limit(1)
      )[0]
    : undefined;
  const materialFileKey = material?.fileUrl ? parseLocalUrl(material.fileUrl) : null;

  return (
    <div className="flex flex-1 flex-col">
      <header className="mb-3 flex items-center justify-between">
        <h1
          className="text-2xl font-bold text-teal-800"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {daily ? "💬 Let's talk!" : material ? `✍️ ${material.title}` : "📚 Let's learn!"}
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">~{minutesLeft} min left</span>
          <form action={endStudentSessionAction}>
            <input type="hidden" name="sessionId" value={sessionId} />
            <button
              type="submit"
              className="rounded-full border border-slate-300 bg-white/70 px-3 py-1.5 text-xs text-slate-500 hover:bg-white"
            >
              I&apos;m done 👋
            </button>
          </form>
        </div>
      </header>
      {material ? (
        <div className="mb-3 rounded-2xl border border-teal-200 bg-teal-50/70 px-4 py-3 text-sm text-teal-900">
          {material.instructions ? <p>{material.instructions}</p> : null}
          <p className={material.instructions ? "mt-1" : ""}>
            ✍️ Show your try first — type your answer or your working, then we&apos;ll figure it out
            together!
            {materialFileKey ? (
              <>
                {" "}
                <a
                  href={`/api/files/${materialFileKey}`}
                  target="_blank"
                  className="font-medium underline"
                >
                  Open the worksheet
                </a>
              </>
            ) : null}
          </p>
          {materialFileKey && material.fileType?.startsWith("image/") ? (
            <a href={`/api/files/${materialFileKey}`} target="_blank">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/files/${materialFileKey}`}
                alt={material.title}
                className="mt-2 max-h-56 rounded-lg border border-teal-200"
              />
            </a>
          ) : null}
        </div>
      ) : null}
      <ChatWindow
        chatId={sessionId}
        endpoint="/api/student/chat"
        payloadKey="sessionId"
        variant="kid"
        initialMessages={[]}
      />
    </div>
  );
}
