import { NextRequest, NextResponse } from "next/server";
import { canUserAccessStudent } from "@platform/shared";
import { currentAppUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { isChildOfGuardianUser } from "@/lib/parents";
import { getStorage } from "@/lib/storage";
import { studentForUser } from "@/lib/student";

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
};

/**
 * Auth-checked serving of locally stored files. Storage keys are
 * `<studentId>/<uuid>.<ext>` for the child's own work samples and
 * `materials/<studentId>/<uuid>.<ext>` for teaching materials (v6) — the
 * prefix scopes access. Students may read ONLY their own material files:
 * the dedicated prefix is what keeps their work-sample files (uploaded by
 * parents/teachers) off-limits until v7 decides that surface.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const user = await currentAppUser();
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { path: segments } = await params;
  if (!segments || segments.length < 2) {
    return NextResponse.json({ error: "Bad path" }, { status: 400 });
  }

  const isMaterial = segments[0] === "materials";
  if (isMaterial && segments.length < 3) {
    return NextResponse.json({ error: "Bad path" }, { status: 400 });
  }
  const studentId = isMaterial ? segments[1]! : segments[0]!;

  if (user.role === "student") {
    const ownStudent = await studentForUser(user.id);
    if (!isMaterial || !ownStudent || ownStudent.id !== studentId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (user.role === "teacher") {
    const allowed = await canUserAccessStudent(getDb(), {
      userId: user.id,
      role: "teacher",
      studentId,
    });
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } else if (user.role === "guardian") {
    const { ok } = await isChildOfGuardianUser(getDb(), user.id, studentId);
    if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const key = segments.join("/");
  const file = await getStorage().get(key);
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=300",
    },
  });
}
