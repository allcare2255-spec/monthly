import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getServiceClient } from "@/lib/supabase";

const BUCKET = "coaching-photos";

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

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

// POST (multipart) { file, student_id, cycle, week, date } → 업로드 후 { url, path }
export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  const studentId = String(form.get("student_id") || "");
  const cycle = String(form.get("cycle") || "0");
  const week = String(form.get("week") || "0");
  const date = String(form.get("date") || "day");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "파일이 없습니다" }, { status: 400 });
  }
  if (!studentId) return NextResponse.json({ error: "student_id 누락" }, { status: 400 });

  const access = await ensureCanAccess(studentId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const ext = EXT[file.type] || "jpg";
  const path = `${studentId}/${cycle}-${week}/${date}-${crypto.randomUUID()}.${ext}`;

  const supabase = getServiceClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl, path });
}

// DELETE { student_id, path } → 스토리지에서 사진 삭제
export async function DELETE(req: Request) {
  const { student_id, path } = await req.json();
  if (!student_id || !path) return NextResponse.json({ error: "student_id / path 누락" }, { status: 400 });
  const access = await ensureCanAccess(student_id);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  // 경로 변조 방지: 반드시 해당 학생 폴더 하위만 삭제
  if (!String(path).startsWith(`${student_id}/`)) {
    return NextResponse.json({ error: "잘못된 경로" }, { status: 400 });
  }

  const supabase = getServiceClient();
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
