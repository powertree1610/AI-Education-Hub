import { NextRequest, NextResponse } from "next/server";
import { canUserAccessStudent } from "@platform/shared";
import { currentAppUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getStorage } from "@/lib/storage";

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
};

/**
 * Auth-checked serving of locally stored files. Storage keys are
 * `<studentId>/<uuid>.<ext>`, so the first path segment scopes access.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const user = await currentAppUser();
  if (!user || (user.role !== "admin" && user.role !== "teacher")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { path: segments } = await params;
  if (!segments || segments.length < 2) {
    return NextResponse.json({ error: "Bad path" }, { status: 400 });
  }

  const studentId = segments[0]!;
  if (user.role === "teacher") {
    const allowed = await canUserAccessStudent(getDb(), {
      userId: user.id,
      role: "teacher",
      studentId,
    });
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
