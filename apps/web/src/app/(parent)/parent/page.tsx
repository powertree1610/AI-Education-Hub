import Link from "next/link";
import { requireRoleOrRedirect } from "@/lib/guard";
import { getDb } from "@/lib/db";
import { listChildrenOfGuardianUser } from "@/lib/parents";

export const dynamic = "force-dynamic";

export default async function ParentHome() {
  const user = await requireRoleOrRedirect("guardian");
  const children = await listChildrenOfGuardianUser(getDb(), user.id);

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold">My Children</h1>
      {children.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          No children are linked to your account yet — please contact the centre.
        </p>
      ) : (
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {children.map((child) => (
            <li key={child.id}>
              <Link
                href={`/parent/children/${child.id}`}
                className="block rounded-lg border border-slate-200 bg-white p-4 hover:border-teal-500"
              >
                <div className="font-medium">{child.fullName}</div>
                <div className="mt-1 text-sm text-slate-500">
                  {child.studentCode} · {child.schoolGrade ?? "—"} · you are the {child.relationship}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
