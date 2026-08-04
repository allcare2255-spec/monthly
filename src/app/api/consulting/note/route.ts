import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getServiceClient } from "@/lib/supabase";
import { upsertNote } from "@/lib/consulting/store";

// 학생 접근 권한 확인 (admin 또는 담당 멘토) — /api/cycles 와 동일한 패턴
async function ensureCanAccess(studentId: string) {
  const session = await getSession();
  if (!session) return { ok: false as const, error: "권한 없음", status: 401 };
  if (session.role === "admin") return { ok: true as const, session };
  const supabase = getServiceClient();
  const { data: student } = await supabase
    .from("coaching_students")
    .select("mentor_id")
    .eq("id", studentId)
    .maybeSingle();
  if (!student || student.mentor_id !== session.mentorId) {
    return { ok: false as const, error: "권한 없음", status: 403 };
  }
  return { ok: true as const, session };
}

// PUT { student_id, week_number, note } → 멘토 컨설팅 메모 저장 (upsert)
export async function PUT(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });

  const studentId = String(body.student_id || "");
  const weekNumber = Number(body.week_number);
  if (!studentId || !Number.isInteger(weekNumber) || weekNumber < 1) {
    return NextResponse.json({ error: "student_id / week_number 누락" }, { status: 400 });
  }

  const access = await ensureCanAccess(studentId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const note = await upsertNote({
      studentId,
      weekNumber,
      note: String(body.note ?? ""),
      authorName: access.session.role === "admin" ? "관리자" : (access.session.mentorName ?? null),
    });
    return NextResponse.json({ note });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "저장 실패";
    // 마이그레이션 미적용 시 안내
    if (/consulting_notes/.test(msg)) {
      return NextResponse.json(
        { error: "컨설팅 메모 테이블이 아직 없습니다. 20260804_consulting_notes.sql 을 적용해주세요." },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
