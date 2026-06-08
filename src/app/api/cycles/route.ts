import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getServiceClient } from "@/lib/supabase";

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

// GET ?student_id=  → 해당 학생의 월차 오버라이드 목록
export async function GET(req: Request) {
  const url = new URL(req.url);
  const studentId = url.searchParams.get("student_id");
  if (!studentId) return NextResponse.json({ error: "student_id 누락" }, { status: 400 });
  const access = await ensureCanAccess(studentId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("coaching_cycles")
    .select("*")
    .eq("student_id", studentId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ cycles: data || [] });
}

// PATCH { student_id, cycle_number, start_date?, end_date?, memo? } → upsert
export async function PATCH(req: Request) {
  const body = await req.json();
  const { student_id, cycle_number, ...rest } = body;
  if (!student_id || !cycle_number) {
    return NextResponse.json({ error: "student_id / cycle_number 누락" }, { status: 400 });
  }
  const access = await ensureCanAccess(student_id);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const patch: Record<string, unknown> = {};
  for (const k of ["start_date", "end_date", "memo"]) {
    if (k in rest) patch[k] = rest[k] === "" ? null : rest[k];
  }
  // [변경 2-2] 관리자 메모 목록 (jsonb 배열)
  if ("notes" in rest) patch.notes = Array.isArray(rest.notes) ? rest.notes : [];

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("coaching_cycles")
    .upsert(
      { student_id, cycle_number, ...patch, updated_at: new Date().toISOString() },
      { onConflict: "student_id,cycle_number" },
    )
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ cycle: data });
}
