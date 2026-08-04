import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { getServiceClient } from "@/lib/supabase";
import { addDays, cumulativeWeek, resolveCycleStart, type CycleAnchor } from "@/lib/dates";
import { getSubmissionByWeekAnyForm, getNoteByWeek } from "@/lib/consulting/store";
import { weekStateFromWeek } from "@/lib/consulting/week";
import { FORM_TITLE } from "@/lib/consulting/forms";
import type { ConsultingSubmission, ConsultingNote, ConsultingFormType } from "@/types";
import { ConsultWorkspace } from "./consult-workspace";

export const dynamic = "force-dynamic";

export default async function ConsultPage({
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
    .select("id, name, grade, coaching_start_date, mentor_id, mentor:coaching_mentors(name)")
    .eq("id", id)
    .maybeSingle();
  if (!student) return notFound();
  if (session.role !== "admin" && student.mentor_id !== session.mentorId) return notFound();

  const cumWeek = cumulativeWeek(cycle, week);

  const [{ data: restarts }, { data: cycleRow }, submission, noteResult] = await Promise.all([
    supabase.from("coaching_restarts").select("cycle_number, start_date").eq("student_id", id),
    supabase
      .from("coaching_cycles")
      .select("start_date, end_date")
      .eq("student_id", id)
      .eq("cycle_number", cycle)
      .maybeSingle(),
    getSubmissionByWeekAnyForm(id, cumWeek).catch(() => null as ConsultingSubmission | null),
    // 마이그레이션 미적용 시에도 페이지가 죽지 않도록 방어
    getNoteByWeek(id, cumWeek).then(
      (n) => ({ ready: true, note: n }),
      () => ({ ready: false, note: null as ConsultingNote | null }),
    ),
  ]);

  const anchors: CycleAnchor[] = (restarts || []).map((r) => ({
    cycle: r.cycle_number,
    start_date: r.start_date,
  }));

  const start = student.coaching_start_date;
  const cycleStart = start ? resolveCycleStart(start, cycle, anchors) : null;
  const effectiveStart = cycleRow?.start_date || cycleStart;
  const weekStart = effectiveStart ? addDays(effectiveStart, (week - 1) * 7) : null;
  const weekEnd = weekStart ? addDays(weekStart, 6) : null;

  // 이 주차에 예정된 폼 종류 (제출물이 없을 때 안내용)
  const state = weekStateFromWeek(cumWeek);
  const expectedType: ConsultingFormType =
    state.kind === "form" ? state.formType : "weekly";

  return (
    <div className="space-y-6">
      <div className="no-print">
        <Link href={`/mentor/students/${id}`} className="text-sm text-ink/55 hover:text-indigo">
          ← {student.name}
        </Link>
        <div className="text-[11px] uppercase tracking-[0.25em] text-indigo font-semibold mt-3">
          Consulting · {cumWeek}주차
        </div>
        <h1 className="text-4xl font-extrabold text-gradient mt-1">
          {student.name} <span className="text-ink/30 font-bold">·</span> {cumWeek}주차 컨설팅
        </h1>
        <p className="text-ink mt-2 text-sm">
          코칭 {cycle}개월차
          {weekStart && weekEnd ? ` · ${weekStart} ~ ${weekEnd}` : ""}
          <span className="ml-2 text-ink/50">
            ({submission ? FORM_TITLE[submission.form_type] : FORM_TITLE[expectedType]})
          </span>
        </p>
      </div>

      {/* 주차 이동 탭 */}
      <div className="flex gap-1 bg-white border border-ink/5 p-1 rounded-xl w-fit shadow-sm no-print">
        {[1, 2, 3, 4].map((w) => (
          <Link
            key={w}
            href={`/mentor/students/${id}/consult?cycle=${cycle}&week=${w}`}
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
          className="ml-2 px-4 py-2 rounded-lg text-sm font-semibold text-ink/60 hover:bg-indigo/5"
        >
          레포트 →
        </Link>
      </div>

      {!noteResult.ready && (
        <div className="rounded-2xl bg-gradient-to-br from-sunset/10 to-rose/10 border border-sunset/30 p-5 text-sm text-ink/75 no-print">
          멘토 메모 저장 기능은 DB 마이그레이션(
          <code className="text-xs">20260804_consulting_notes.sql</code>) 적용 후 사용할 수 있습니다.
        </div>
      )}

      <ConsultWorkspace
        studentId={id}
        studentName={student.name}
        mentorName={(student as unknown as { mentor?: { name: string } | null }).mentor?.name || ""}
        cumWeek={cumWeek}
        cycle={cycle}
        weekStart={weekStart}
        weekEnd={weekEnd}
        submission={submission}
        expectedType={expectedType}
        initialNote={noteResult.note?.note ?? ""}
        noteSavable={noteResult.ready}
      />
    </div>
  );
}
