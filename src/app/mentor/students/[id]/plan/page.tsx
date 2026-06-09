import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { getServiceClient } from "@/lib/supabase";
import { addDays, cumulativeWeek, resolveCycleStart, type CycleAnchor } from "@/lib/dates";
import { WeeklyPlanEditor } from "./plan-editor";

export const dynamic = "force-dynamic";

export default async function WeeklyPlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cycle?: string; week?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const cycle = Number(sp.cycle || 1);
  const week = Number(sp.week || 1);

  const session = await getSession();
  if (!session?.mentorId && session?.role !== "admin") return null;

  const supabase = getServiceClient();
  const { data: student } = await supabase
    .from("coaching_students")
    .select("id, name, coaching_start_date, mentor_id")
    .eq("id", id)
    .maybeSingle();
  if (!student) return notFound();
  if (session.role !== "admin" && student.mentor_id !== session.mentorId) return notFound();
  if (!student.coaching_start_date) return notFound();

  const { data: restarts } = await supabase
    .from("coaching_restarts")
    .select("cycle_number, start_date")
    .eq("student_id", id);
  const anchors: CycleAnchor[] = (restarts || []).map((r) => ({
    cycle: r.cycle_number,
    start_date: r.start_date,
  }));

  const cycleStart = resolveCycleStart(student.coaching_start_date, cycle, anchors);
  const weekStart = addDays(cycleStart, (week - 1) * 7);
  const dates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)); // 월~일

  return (
    <div className="space-y-6">
      <div className="no-print">
        <Link href={`/mentor/students/${id}`} className="text-sm text-ink/55 hover:text-indigo">
          ← {student.name}
        </Link>
        <div className="text-[11px] uppercase tracking-[0.25em] text-indigo font-semibold mt-3">
          Weekly Plan · {cumulativeWeek(cycle, week)}주차
        </div>
        <h1 className="text-3xl font-extrabold text-gradient mt-1">
          {student.name} · {cumulativeWeek(cycle, week)}주차 주간 계획표
        </h1>
        <p className="text-ink/55 mt-2 text-sm">
          코칭 {cycle}개월차 · {weekStart} ~ {dates[6]}
        </p>

        <div className="flex gap-1 bg-white border border-ink/5 p-1 rounded-xl w-fit shadow-sm mt-4">
          {[1, 2, 3, 4].map((w) => (
            <Link
              key={w}
              href={`/mentor/students/${id}/plan?cycle=${cycle}&week=${w}`}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                w === week
                  ? "bg-gradient-to-r from-indigo to-violet text-white shadow-md shadow-indigo/30"
                  : "text-ink/60 hover:bg-indigo/5"
              }`}
            >
              {cumulativeWeek(cycle, w)}주차
            </Link>
          ))}
          <Link
            href={`/mentor/students/${id}/weekly?cycle=${cycle}&week=${week}`}
            className="ml-2 px-4 py-2 rounded-lg text-sm font-semibold text-fuchsia hover:bg-fuchsia/5"
          >
            주간 레포트 →
          </Link>
        </div>
      </div>

      <WeeklyPlanEditor studentId={id} cycle={cycle} week={week} dates={dates} />
    </div>
  );
}
