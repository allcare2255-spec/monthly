import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getServiceClient } from "@/lib/supabase";
import { getNoteShare, setNoteShare, ShareNotReadyError } from "@/lib/consulting/store";

// 학생 접근 권한 확인 (admin 또는 담당 멘토) — /api/consulting/note 와 동일한 패턴
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

function parse(searchParams: URLSearchParams) {
  const studentId = String(searchParams.get("student_id") || "");
  const weekNumber = Number(searchParams.get("week_number"));
  return { studentId, weekNumber };
}

function badRequest() {
  return NextResponse.json({ error: "student_id / week_number 누락" }, { status: 400 });
}

function fail(e: unknown) {
  if (e instanceof ShareNotReadyError) {
    return NextResponse.json({ error: e.message, notReady: true }, { status: 409 });
  }
  return NextResponse.json({ error: e instanceof Error ? e.message : "실패" }, { status: 500 });
}

// GET ?student_id=&week_number= → 현재 공유 상태
export async function GET(req: Request) {
  const { studentId, weekNumber } = parse(new URL(req.url).searchParams);
  if (!studentId || !Number.isInteger(weekNumber) || weekNumber < 1) return badRequest();

  const access = await ensureCanAccess(studentId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    return NextResponse.json(await getNoteShare(studentId, weekNumber));
  } catch (e) {
    return fail(e);
  }
}

// POST { student_id, week_number, action: enable | disable | regenerate }
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });

  const studentId = String(body.student_id || "");
  const weekNumber = Number(body.week_number);
  const action = String(body.action || "");
  if (!studentId || !Number.isInteger(weekNumber) || weekNumber < 1) return badRequest();
  if (!["enable", "disable", "regenerate"].includes(action)) {
    return NextResponse.json({ error: "action 값이 올바르지 않습니다." }, { status: 400 });
  }

  const access = await ensureCanAccess(studentId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const share = await setNoteShare(
      studentId,
      weekNumber,
      action as "enable" | "disable" | "regenerate",
    );
    return NextResponse.json(share);
  } catch (e) {
    return fail(e);
  }
}
