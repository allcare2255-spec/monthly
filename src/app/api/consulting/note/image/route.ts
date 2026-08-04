import { NextResponse } from "next/server";
import crypto from "crypto";
import { getSession } from "@/lib/session";
import { getServiceClient } from "@/lib/supabase";

const BUCKET = "coaching-photos";
const MAX_BYTES = 10 * 1024 * 1024; // 10MB

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
};

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

// POST (multipart) { file, student_id } → 컨설팅 메모 본문에 넣을 이미지 업로드
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
  if (!EXT[file.type]) {
    return NextResponse.json(
      { error: "이미지 파일만 넣을 수 있습니다 (png/jpg/webp/gif/heic)." },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "이미지 용량은 10MB 이하만 가능합니다." }, { status: 400 });
  }

  const path = `consult-notes/${studentId}/${crypto.randomUUID()}.${EXT[file.type]}`;

  const supabase = getServiceClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl, path });
}
