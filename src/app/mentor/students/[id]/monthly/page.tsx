import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { getServiceClient } from "@/lib/supabase";
import { addDays, cumulativeWeek, resolveCycleStart, type CycleAnchor } from "@/lib/dates";
import { MonthlyReportView } from "./monthly-view";
import { EditableCycleDate, AdminMemoPanel, type CycleNote } from "../report-extras";
import type { DayData, WeeklyReport } from "@/types";

export const dynamic = "force-dynamic";

export default async function MonthlyReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cycle?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const cycle = Number(sp.cycle || 1);

  const session = await getSession();
  if (!session) return null;

  const supabase = getServiceClient();
  const { data: student } = await supabase
    .from("coaching_students")
    .select("*, mentor:coaching_mentors(name)")
    .eq("id", id)
    .maybeSingle();
  if (!student) return notFound();
  if (session.role !== "admin" && (student as any).mentor_id !== session.mentorId) return notFound();
  if (!student.coaching_start_date) return notFound();

  // 사이클 내 4주간 weekly 데이터 미리 모두 가져오기 (없으면 빈 row 생성하지 않음 — 시각화는 빈 값 처리)
  const { data: weeklies } = await supabase
    .from("coaching_weekly_reports")
    .select("*")
    .eq("student_id", id)
    .eq("cycle_number", cycle)
    .order("week_number");

  // monthly row 보장
  const { data: monthly } = await supabase
    .from("coaching_monthly_reports")
    .select("*")
    .eq("student_id", id)
    .eq("cycle_number", cycle)
    .maybeSingle();

  // [변경 3] 재시작 앵커 / [변경 2] 월차 오버라이드·메모
  const { data: restarts } = await supabase
    .from("coaching_restarts")
    .select("cycle_number, start_date")
    .eq("student_id", id);
  const anchors: CycleAnchor[] = (restarts || []).map((r) => ({
    cycle: r.cycle_number,
    start_date: r.start_date,
  }));

  const { data: cycleRow } = await supabase
    .from("coaching_cycles")
    .select("start_date, end_date, notes")
    .eq("student_id", id)
    .eq("cycle_number", cycle)
    .maybeSingle();

  const cycleStart = resolveCycleStart(student.coaching_start_date, cycle, anchors);
  const cycleEnd = addDays(cycleStart, 27);
  const notes = (cycleRow?.notes as CycleNote[]) || [];

  return (
    <div className="space-y-6">
      <div className="no-print">
        <Link href={`/mentor/students/${id}`} className="text-sm text-ink/55 hover:text-fuchsia">
          ← {student.name}
        </Link>
        <div className="text-[11px] uppercase tracking-[0.25em] text-fuchsia font-semibold mt-3">
          Monthly · 코칭 {cycle}개월차
        </div>
        <h1 className="text-4xl font-extrabold text-gradient mt-1">
          {student.name} <span className="text-ink/30 font-bold">·</span> 코칭 {cycle}개월차
        </h1>
        <p className="text-ink/55 mt-2 text-sm">
          <EditableCycleDate
            studentId={id}
            cycle={cycle}
            defaultStart={cycleStart}
            defaultEnd={cycleEnd}
            overrideStart={cycleRow?.start_date ?? null}
            overrideEnd={cycleRow?.end_date ?? null}
          />
          {session.role === "admin" && (
            <span className="ml-2 inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-gradient-to-r from-fuchsia to-rose text-white">
              ADMIN
            </span>
          )}
        </p>
      </div>

      <AdminMemoPanel studentId={id} cycle={cycle} initialNotes={notes} />

      <div className="flex gap-1 bg-white border border-ink/5 p-1 rounded-xl w-fit shadow-sm no-print">
        {[1, 2, 3, 4].map((w) => (
          <Link
            key={w}
            href={`/mentor/students/${id}/weekly?cycle=${cycle}&week=${w}`}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-ink/55 hover:bg-indigo/5"
          >
            {cumulativeWeek(cycle, w)}주차
          </Link>
        ))}
        <span className="px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-fuchsia to-rose text-white shadow-md shadow-fuchsia/30">
          월간
        </span>
      </div>

      <MonthlyReportView
        studentId={id}
        studentName={student.name}
        highSchool={student.high_school}
        mentorName={(student as any).mentor?.name || ""}
        cycle={cycle}
        cycleStart={cycleStart}
        cycleEnd={cycleEnd}
        weeklies={(weeklies as WeeklyReport[]) || []}
        initialMonthly={monthly as any}
      />
    </div>
  );
}

export type CycleDays = DayData[];
