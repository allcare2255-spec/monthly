import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getServiceClient } from "@/lib/supabase";
import { addDays, weekRange, resolveCycleStart, type CycleAnchor } from "@/lib/dates";
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
  const { start, end } = weekRange(cycleStart, week);
  const dates = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  const { data: existing } = await supabase
    .from("coaching_weekly_reports")
    .select("*")
    .eq("student_id", studentId)
    .eq("cycle_number", cycle)
    .eq("week_number", week)
    .maybeSingle();

  if (existing) {
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
