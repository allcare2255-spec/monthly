import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getServiceClient } from "@/lib/supabase";
import { upsertMidtermResult, MidtermNotReadyError } from "@/lib/consulting/store";

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

// PUT { student_id, exam_key, content } → 중간고사 결과 저장 (upsert)
export async function PUT(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });

  const studentId = String(body.student_id || "");
  const examKey = String(body.exam_key || "").trim();
  if (!studentId || !examKey) {
    return NextResponse.json({ error: "student_id / exam_key 누락" }, { status: 400 });
  }

  const access = await ensureCanAccess(studentId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    await upsertMidtermResult({
      studentId,
      examKey,
      content: String(body.content ?? ""),
      authorName: access.session.role === "admin" ? "관리자" : (access.session.mentorName ?? null),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof MidtermNotReadyError) {
      return NextResponse.json(
        { error: "중간고사 결과 테이블이 아직 없습니다. 20261013_midterm_results.sql 을 적용해주세요." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : "저장 실패" }, { status: 500 });
  }
}
