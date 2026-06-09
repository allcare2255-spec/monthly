import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getServiceClient } from "@/lib/supabase";
import type { WeeklyPlanData, WeekdayKey } from "@/types";

const WEEKDAYS: WeekdayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function emptyPlan(): WeeklyPlanData {
  return {
    weekly_goals: [],
    main_test: [],
    days: WEEKDAYS.reduce(
      (acc, k) => ({ ...acc, [k]: { notes: "", tasks: [] } }),
      {} as WeeklyPlanData["days"],
    ),
    summary: { achievement: "", feedback: "" },
  };
}

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

// GET ?student_id=&cycle=&week=  → 없으면 빈 계획 생성 후 반환
export async function GET(req: Request) {
  const url = new URL(req.url);
  const studentId = url.searchParams.get("student_id")!;
  const cycle = Number(url.searchParams.get("cycle") || 1);
  const week = Number(url.searchParams.get("week") || 1);
  const access = await ensureCanAccess(studentId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const supabase = getServiceClient();
  const { data: existing, error } = await supabase
    .from("coaching_weekly_plans")
    .select("*")
    .eq("student_id", studentId)
    .eq("cycle_number", cycle)
    .eq("week_number", week)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (existing) return NextResponse.json({ plan: existing });

  const { data: created, error: insErr } = await supabase
    .from("coaching_weekly_plans")
    .insert({ student_id: studentId, cycle_number: cycle, week_number: week, plan_data: emptyPlan() })
    .select()
    .single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  return NextResponse.json({ plan: created });
}

// PATCH { student_id, cycle, week, plan_data } → upsert (자동저장)
export async function PATCH(req: Request) {
  const { student_id, cycle, week, plan_data } = await req.json();
  if (!student_id || !cycle || !week) {
    return NextResponse.json({ error: "student_id / cycle / week 누락" }, { status: 400 });
  }
  const access = await ensureCanAccess(student_id);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("coaching_weekly_plans")
    .upsert(
      {
        student_id,
        cycle_number: cycle,
        week_number: week,
        plan_data: plan_data ?? emptyPlan(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "student_id,cycle_number,week_number" },
    )
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ plan: data });
}
