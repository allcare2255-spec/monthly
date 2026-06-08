import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { getServiceClient } from "@/lib/supabase";
import { addDays, cumulativeWeek, resolveCycleStart, type CycleAnchor } from "@/lib/dates";
import { WeeklyReportEditor } from "./weekly-editor";
import { EditableCycleDate, AdminMemoPanel, type CycleNote } from "../report-extras";

export const dynamic = "force-dynamic";

export default async function WeeklyReportPage({
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
    .select("id, name, high_school, coaching_start_date, mentor_id")
    .eq("id", id)
    .maybeSingle();
  if (!student) return notFound();
  if (session.role !== "admin" && student.mentor_id !== session.mentorId) return notFound();
  if (!student.coaching_start_date) return notFound();

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
      <div>
        <Link
          href={`/mentor/students/${id}`}
          className="text-sm text-ink/55 hover:text-indigo no-print"
        >
          ← {student.name}
        </Link>
        <div className="text-[11px] uppercase tracking-[0.25em] text-indigo font-semibold mt-3">
          Weekly · {cumulativeWeek(cycle, week)}주차
        </div>
        <h1 className="text-4xl font-extrabold text-gradient mt-1">
          {student.name} <span className="text-ink/30 font-bold">·</span> {cumulativeWeek(cycle, week)}주차
        </h1>
        <p className="text-ink/55 mt-2 text-sm">
          코칭 {cycle}개월차 ·{" "}
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
          href={`/mentor/students/${id}/monthly?cycle=${cycle}`}
          className="ml-2 px-4 py-2 rounded-lg text-sm font-semibold text-fuchsia hover:bg-fuchsia/5"
        >
          월간 →
        </Link>
      </div>

      <WeeklyReportEditor studentId={id} cycle={cycle} week={week} />
    </div>
  );
}
