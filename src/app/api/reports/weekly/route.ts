import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getServiceClient } from "@/lib/supabase";
import { addDays, resolveCycleStart, type CycleAnchor } from "@/lib/dates";
import type { DayData } from "@/types";

async function ensureCanAccess(studentId: string) {
  const session = await getSession();
  if (!session) return { ok: false, error: "권한 없음", status: 401 };
  if (session.role === "admin") return { ok: true, session };
  const supabase = getServiceClient();
  const { data: student } = await supabase
    .from("coaching_students")
    .select("mentor_id")
    .eq("id", studentId)
    .maybeSingle();
  if (!student || student.mentor_id !== session.mentorId) {
    return { ok: false, error: "권한 없음", status: 403 };
  }
  return { ok: true, session };
}

function emptyDayData(dates: string[]): DayData[] {
  return dates.map((d) => ({
    date: d,
    wake_up_time: null,
    study_minutes: null,
    memo: null,
    status: "unset",
  }));
}

// GET ?student_id=&cycle=&week=  → upsert empty if not exists
export async function GET(req: Request) {
  const url = new URL(req.url);
  const studentId = url.searchParams.get("student_id")!;
  const cycle = Number(url.searchParams.get("cycle") || 1);
  const week = Number(url.searchParams.get("week") || 1);
  const access = await ensureCanAccess(studentId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const supabase = getServiceClient();
  const { data: student } = await supabase
    .from("coaching_students")
    .select("coaching_start_date")
    .eq("id", studentId)
    .maybeSingle();
  if (!student?.coaching_start_date) {
    return NextResponse.json({ error: "코칭 시작일이 설정되지 않음" }, { status: 400 });
  }

  // [변경 3] 재시작 앵커 반영한 사이클 시작일
  const { data: restarts } = await supabase
    .from("coaching_restarts")
    .select("cycle_number, start_date")
    .eq("student_id", studentId);
  const anchors: CycleAnchor[] = (restarts || []).map((r) => ({
    cycle: r.cycle_number,
    start_date: r.start_date,
  }));
  const cycleStart = resolveCycleStart(student.coaching_start_date, cycle, anchors);
  // 학생 상세 페이지에서 수정한 월차 시작일 오버라이드가 있으면 그것을 우선.
  // (레포트 헤더/일별 기록 날짜가 항상 같은 기준을 쓰도록 함)
  const { data: cycleRow } = await supabase
    .from("coaching_cycles")
    .select("start_date")
    .eq("student_id", studentId)
    .eq("cycle_number", cycle)
    .maybeSingle();
  const effectiveStart = cycleRow?.start_date || cycleStart;
  const start = addDays(effectiveStart, (week - 1) * 7);
  const end = addDays(start, 6);
  const dates = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  const { data: existing } = await supabase
    .from("coaching_weekly_reports")
    .select("*")
    .eq("student_id", studentId)
    .eq("cycle_number", cycle)
    .eq("week_number", week)
    .maybeSingle();

  if (existing) {
    // 이미 저장된 레포트의 일별 날짜가 기준(헤더)과 어긋나면 위치 그대로 날짜만 재정렬해 복구.
    // (월요일 칸 데이터는 월요일에 그대로 남고, 날짜 라벨만 올바른 날짜로 교정됨)
    const existingDays: DayData[] = Array.isArray(existing.day_data) ? existing.day_data : [];
    const needsRealign =
      existingDays.length === 7 && existingDays.some((d, i) => d.date !== dates[i]);
    if (needsRealign) {
      const realigned = existingDays.map((d, i) => ({ ...d, date: dates[i] }));
      const { data: updated } = await supabase
        .from("coaching_weekly_reports")
        .update({ day_data: realigned, start_date: start, end_date: end })
        .eq("id", existing.id)
        .select()
        .single();
      return NextResponse.json({
        report: updated || { ...existing, day_data: realigned, start_date: start, end_date: end },
        dates,
      });
    }
    return NextResponse.json({ report: existing, dates });
  }

  // 없으면 빈 row 생성 (initial)
  const { data: created, error } = await supabase
    .from("coaching_weekly_reports")
    .insert({
      student_id: studentId,
      cycle_number: cycle,
      week_number: week,
      start_date: start,
      end_date: end,
      day_data: emptyDayData(dates),
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ report: created, dates });
}

// PATCH { id, ...patch }
export async function PATCH(req: Request) {
  const body = await req.json();
  const { id, student_id, ...patch } = body;
  const access = await ensureCanAccess(student_id);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("coaching_weekly_reports")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ report: data });
}
