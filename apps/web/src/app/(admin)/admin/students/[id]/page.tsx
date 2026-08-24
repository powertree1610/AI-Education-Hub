import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, isNull } from "drizzle-orm";
import { schema as s } from "@platform/db";
import { CONSENT_TYPES, getCurrentConsents, parseLocalUrl } from "@platform/shared";
import { endStudentTeacherAction, linkStudentTeacherAction } from "@/actions/classes";
import { enableGuardianPortalAction } from "@/actions/parents";
import { setConsentAction } from "@/actions/students";
import { uploadWorkSampleAction } from "@/actions/uploads";
import { ResultsSection } from "@/components/results-section";
import { CONSENT_LABELS } from "@/lib/consent-labels";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const field = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm";
const label = "block text-sm font-medium text-slate-700";

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();

  const student = (await db.select().from(s.students).where(eq(s.students.id, id)).limit(1))[0];
  if (!student) notFound();

  const guardians = await db
    .select({
      guardianId: s.guardians.id,
      userId: s.guardians.userId,
      name: s.guardians.name,
      phone: s.guardians.phone,
      email: s.guardians.email,
      relationship: s.studentGuardians.relationship,
      isPrimary: s.studentGuardians.isPrimary,
    })
    .from(s.studentGuardians)
    .innerJoin(s.guardians, eq(s.guardians.id, s.studentGuardians.guardianId))
    .where(eq(s.studentGuardians.studentId, id));

  const consents = await getCurrentConsents(db, id);

  const samples = await db
    .select({
      id: s.workSamples.id,
      workType: s.workSamples.workType,
      title: s.workSamples.titleTopic,
      workDate: s.workSamples.workDate,
      fileUrl: s.workSamples.fileUrl,
      fileType: s.workSamples.fileType,
      subjectName: s.subjects.name,
      createdAt: s.workSamples.createdAt,
    })
    .from(s.workSamples)
    .leftJoin(s.subjects, eq(s.subjects.id, s.workSamples.subjectId))
    .where(eq(s.workSamples.studentId, id))
    .orderBy(desc(s.workSamples.createdAt));

  const subjects = await db.select().from(s.subjects).orderBy(s.subjects.name);

  const directTeachers = await db
    .select({
      id: s.studentTeachers.id,
      role: s.studentTeachers.role,
      startDate: s.studentTeachers.startDate,
      teacherName: s.users.name,
      subjectName: s.subjects.name,
    })
    .from(s.studentTeachers)
    .innerJoin(s.users, eq(s.users.id, s.studentTeachers.userId))
    .leftJoin(s.subjects, eq(s.subjects.id, s.studentTeachers.subjectId))
    .where(and(eq(s.studentTeachers.studentId, id), isNull(s.studentTeachers.endDate)));

  const currentClasses = await db
    .select({
      className: s.vStudentCurrentClasses.className,
      startDate: s.vStudentCurrentClasses.startDate,
    })
    .from(s.vStudentCurrentClasses)
    .where(eq(s.vStudentCurrentClasses.studentId, id));

  const teacherUsers = await db
    .select({ id: s.users.id, name: s.users.name })
    .from(s.users)
    .where(and(eq(s.users.role, "teacher"), eq(s.users.isActive, true)))
    .orderBy(s.users.name);

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-start justify-between">
          <h1 className="text-xl font-semibold">
            {student.fullName}{" "}
            <span className="text-base font-normal text-slate-500">· {student.studentCode}</span>
          </h1>
          <Link
            href={`/admin/students/${id}/questionnaire`}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Enter parent questionnaire
          </Link>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 rounded-lg border border-slate-200 bg-white p-4 text-sm md:grid-cols-4">
          <div>
            <dt className="text-slate-500">Date of birth</dt>
            <dd>{student.dob}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Status</dt>
            <dd>{student.status}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Programme</dt>
            <dd>{student.programme ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">School</dt>
            <dd>
              {student.schoolName ?? "—"} {student.schoolGrade ? `(${student.schoolGrade})` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">AI language</dt>
            <dd>{student.preferredAiLanguage ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">AI access level</dt>
            <dd>{student.aiAccessLevel}</dd>
          </div>
        </dl>
      </div>

      <section>
        <h2 className="font-medium">Guardians</h2>
        {guardians.length === 0 ? (
          <p className="mt-2 text-sm text-amber-600">
            No guardian on record — consents cannot be recorded until one is added.
          </p>
        ) : (
          <ul className="mt-2 rounded-lg border border-slate-200 bg-white text-sm">
            {guardians.map((g, i) => (
              <li
                key={i}
                className="flex items-center justify-between border-b border-slate-100 px-4 py-2 last:border-0"
              >
                <span className="flex gap-4">
                  <span className="font-medium">{g.name}</span>
                  <span className="text-slate-500">{g.relationship}</span>
                  <span className="text-slate-500">{g.phone ?? ""}</span>
                  <span className="text-slate-500">{g.email ?? ""}</span>
                  {g.isPrimary ? <span className="text-xs text-teal-700">primary</span> : null}
                </span>
                {g.userId ? (
                  <span className="text-xs text-green-600">portal ✓</span>
                ) : g.email ? (
                  <form action={enableGuardianPortalAction}>
                    <input type="hidden" name="guardianId" value={g.guardianId} />
                    <button type="submit" className="text-xs text-teal-700 hover:underline">
                      enable portal access
                    </button>
                  </form>
                ) : (
                  <span className="text-xs text-slate-400">no email — portal unavailable</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-medium">Teachers & classes</h2>
        <div className="mt-2 rounded-lg border border-slate-200 bg-white text-sm">
          {currentClasses.map((c, i) => (
            <div key={`c${i}`} className="border-b border-slate-100 px-4 py-2">
              <span className="font-medium">{c.className}</span>{" "}
              <span className="text-slate-500">· class · since {c.startDate}</span>
            </div>
          ))}
          {directTeachers.map((t) => (
            <div key={t.id} className="flex items-center justify-between border-b border-slate-100 px-4 py-2 last:border-0">
              <span>
                <span className="font-medium">{t.teacherName}</span>{" "}
                <span className="text-slate-500">
                  · {t.role}
                  {t.subjectName ? ` · ${t.subjectName}` : ""} · since {t.startDate}
                </span>
              </span>
              <form action={endStudentTeacherAction}>
                <input type="hidden" name="studentTeacherId" value={t.id} />
                <button type="submit" className="text-xs text-red-600 hover:underline">
                  end link
                </button>
              </form>
            </div>
          ))}
          {currentClasses.length === 0 && directTeachers.length === 0 ? (
            <div className="px-4 py-2 text-slate-500">
              No class enrollment or direct teacher — teachers cannot see this student yet.
            </div>
          ) : null}
        </div>
        {teacherUsers.length > 0 ? (
          <form action={linkStudentTeacherAction} className="mt-2 flex items-center gap-2">
            <input type="hidden" name="studentId" value={id} />
            <select name="userId" required className="rounded-md border border-slate-300 px-3 py-2 text-sm">
              {teacherUsers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <select name="role" className="rounded-md border border-slate-300 px-3 py-2 text-sm">
              {s.studentTeacherRoleInCore.enumValues.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <select name="subjectId" className="rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="">any subject</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
            >
              Link teacher
            </button>
          </form>
        ) : null}
      </section>

      <ResultsSection studentId={id} />

      <section>
        <h2 className="font-medium">Consents</h2>
        <ul className="mt-2 rounded-lg border border-slate-200 bg-white text-sm">
          {CONSENT_TYPES.map((type) => {
            const status = consents.get(type) ?? "not recorded";
            const granted = status === "granted";
            return (
              <li
                key={type}
                className="flex items-center justify-between border-b border-slate-100 px-4 py-2 last:border-0"
              >
                <span>{CONSENT_LABELS[type]}</span>
                <span className="flex items-center gap-3">
                  <span
                    className={
                      granted
                        ? "text-green-600"
                        : status === "withdrawn"
                          ? "text-red-600"
                          : "text-slate-400"
                    }
                  >
                    {status}
                  </span>
                  {guardians.length > 0 ? (
                    <form action={setConsentAction}>
                      <input type="hidden" name="studentId" value={id} />
                      <input type="hidden" name="consentType" value={type} />
                      <input type="hidden" name="status" value={granted ? "withdrawn" : "granted"} />
                      <button
                        type="submit"
                        className="rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50"
                      >
                        {granted ? "withdraw" : "grant"}
                      </button>
                    </form>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="font-medium">Documents ({samples.length})</h2>
        {samples.length > 0 ? (
          <table className="mt-2 w-full rounded-lg border border-slate-200 bg-white text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="px-4 py-2 font-medium">Title</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Subject</th>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {samples.map((w) => {
                const key = parseLocalUrl(w.fileUrl);
                return (
                  <tr key={w.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2 font-medium">{w.title ?? "Untitled"}</td>
                    <td className="px-4 py-2">{w.workType}</td>
                    <td className="px-4 py-2">{w.subjectName ?? "—"}</td>
                    <td className="px-4 py-2">{w.workDate ?? "—"}</td>
                    <td className="px-4 py-2 text-right">
                      {key ? (
                        <Link
                          href={`/api/files/${key}`}
                          target="_blank"
                          className="text-teal-700 hover:underline"
                        >
                          preview
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="mt-2 text-sm text-slate-500">No documents uploaded yet.</p>
        )}

        <form
          action={uploadWorkSampleAction}
          className="mt-4 grid max-w-2xl grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-white p-4"
        >
          <input type="hidden" name="studentId" value={id} />
          <div className="col-span-2">
            <label className={label}>
              File (JPG, PNG, WebP, PDF — max 15 MB) *
              <input name="file" type="file" required accept=".jpg,.jpeg,.png,.webp,.pdf" className={field} />
            </label>
          </div>
          <label className={label}>
            Title / topic
            <input name="titleTopic" className={field} />
          </label>
          <label className={label}>
            Work type *
            <select name="workType" required className={field}>
              {s.workTypeInCore.enumValues.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Subject
            <select name="subjectId" className={field}>
              <option value="">—</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Source
            <select name="source" defaultValue="centre" className={field}>
              {s.workSourceInCore.enumValues.map((src) => (
                <option key={src} value={src}>
                  {src}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Work date
            <input name="workDate" type="date" className={field} />
          </label>
          <label className={label}>
            School year
            <input name="schoolYear" placeholder="2026" className={field} />
          </label>
          <div className="col-span-2">
            <button
              type="submit"
              className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
            >
              Upload
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
