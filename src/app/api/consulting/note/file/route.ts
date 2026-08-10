import { NextResponse } from "next/server";
import crypto from "crypto";
import { getSession } from "@/lib/session";
import { getServiceClient } from "@/lib/supabase";

const BUCKET = "coaching-photos";
const MAX_BYTES = 20 * 1024 * 1024; // 20MB

/** 첨부 허용 확장자 — 브라우저가 hwp 등에 mime 을 안 붙여주는 경우가 많아 확장자로 판단한다 */
const ALLOWED_EXT = new Set([
  "pdf",
  "hwp",
  "hwpx",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "txt",
  "csv",
  "zip",
]);

// 학생 접근 권한 확인 (admin 또는 담당 멘토)
async function ensureCanAccess(studentId: string) {
  const session = await getSession();
  if (!session) return { ok: false as const, error: "권한 없음", status: 401 };
  if (session.role === "admin") return { ok: true as const };
  const supabase = getServiceClient();
  const { data: student } = await supabase
    .from("coaching_students")
    .select("mentor_id")
    .eq("id", studentId)
    .maybeSingle();
  if (!student || student.mentor_id !== session.mentorId) {
    return { ok: false as const, error: "권한 없음", status: 403 };
  }
  return { ok: true as const };
}

// POST (multipart) { file, student_id } → 컨설팅 메모 본문에 넣을 첨부파일 업로드
export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  const studentId = String(form.get("student_id") || "");

  if (!studentId) return NextResponse.json({ error: "student_id 누락" }, { status: 400 });
  const access = await ensureCanAccess(studentId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
  }

  const name = file.name || "첨부파일";
  const ext = (name.split(".").pop() || "").toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    return NextResponse.json(
      { error: "첨부할 수 없는 형식입니다 (pdf/한글/워드/엑셀/PPT/txt/csv/zip)." },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "첨부 용량은 20MB 이하만 가능합니다." }, { status: 400 });
  }

  const path = `consult-notes/${studentId}/files/${crypto.randomUUID()}.${ext}`;

  const supabase = getServiceClient();
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl, path, name, size: file.size });
}
