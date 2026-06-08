import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getServiceClient } from "@/lib/supabase";
import { mondayOf } from "@/lib/dates";

// [변경 3] 코칭 종료 학생 재시작
// POST { id, restart_date } → 코칭 중 복귀 + 다음 월차를 재시작일 기준으로 앵커
export async function POST(req: Request) {
  const session = await getSession();
  if (session?.role !== "admin") return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const { id, restart_date } = await req.json();
  if (!id || !restart_date) {
    return NextResponse.json({ error: "id / restart_date 누락" }, { status: 400 });
  }
  // 재시작일도 월요일로 보정 → 이후 월차의 주간 레포트가 월요일에 시작
  const anchorDate = mondayOf(restart_date);

  const supabase = getServiceClient();

  // 기존 코칭 이력 기준 다음 월차 계산 (1개월차, 2개월차 … 이어서 카운트)
  const { data: weeklyRows } = await supabase
    .from("coaching_weekly_reports")
    .select("cycle_number")
    .eq("student_id", id);
  const { data: monthlyRows } = await supabase
    .from("coaching_monthly_reports")
    .select("cycle_number")
    .eq("student_id", id);

  const cycleNums = [
    ...(weeklyRows || []).map((r) => r.cycle_number),
    ...(monthlyRows || []).map((r) => r.cycle_number),
  ];
  const nextCycle = cycleNums.length ? Math.max(...cycleNums) + 1 : 1;

  // 코칭 중으로 복귀
  const { error: upErr } = await supabase
    .from("coaching_students")
    .update({ coaching_ended: false })
    .eq("id", id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  // 재시작 앵커: 다음 월차부터 재시작일을 새 기준일로
  const { error: anchorErr } = await supabase
    .from("coaching_restarts")
    .upsert(
      { student_id: id, cycle_number: nextCycle, start_date: anchorDate },
      { onConflict: "student_id,cycle_number" },
    );
  if (anchorErr) return NextResponse.json({ error: anchorErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, next_cycle: nextCycle });
}
