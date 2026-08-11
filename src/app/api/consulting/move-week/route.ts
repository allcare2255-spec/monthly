import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getServiceClient } from "@/lib/supabase";
import { moveConsultingWeek, MoveWeekConflictError } from "@/lib/consulting/store";

// 학생 접근 권한 확인 (admin 또는 담당 멘토) — /api/consulting/note 와 동일한 패턴
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

// POST { student_id, from_week, to_week, move_submission, move_note }
//  → 그 주차의 학생 제출 폼 / 멘토 메모를 다른 주차로 옮긴다
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });

  const studentId = String(body.student_id || "");
  const fromWeek = Number(body.from_week);
  const toWeek = Number(body.to_week);
  if (
    !studentId ||
    !Number.isInteger(fromWeek) ||
    !Number.isInteger(toWeek) ||
    fromWeek < 1 ||
    toWeek < 1
  ) {
    return NextResponse.json({ error: "student_id / 주차 값이 올바르지 않습니다." }, { status: 400 });
  }

  const access = await ensureCanAccess(studentId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const result = await moveConsultingWeek({
      studentId,
      fromWeek,
      toWeek,
      moveSubmission: !!body.move_submission,
      moveNote: !!body.move_note,
      actorName: access.session.role === "admin" ? "관리자" : (access.session.mentorName ?? null),
    });
    return NextResponse.json(result);
  } catch (e) {
    // 옮길 곳에 이미 내용이 있는 경우 — 사용자 잘못이 아니라 안내가 필요한 상황이므로 409
    if (e instanceof MoveWeekConflictError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    const msg = e instanceof Error ? e.message : "이동 실패";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
