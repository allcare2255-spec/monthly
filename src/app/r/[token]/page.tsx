import type { Metadata } from "next";
import { getServiceClient } from "@/lib/supabase";
import { addDays, buildCycleAnchors, resolveCycleStart } from "@/lib/dates";
import { getSharedNoteByToken, getSubmissionByWeekAnyForm } from "@/lib/consulting/store";
import { noteToHtml, isEmptyNoteHtml } from "@/lib/consulting/note-html";
import { fieldsFor, FORM_TITLE } from "@/lib/consulting/forms";
import { weekStateFromWeek } from "@/lib/consulting/week";
import type { ConsultingSubmission, ConsultingFormType } from "@/types";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

// 학생 기록이므로 검색엔진에 절대 노출되지 않게 한다
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default async function SharedConsultPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const shared = await getSharedNoteByToken(token).catch(() => null);
  if (!shared) return <Invalid />;

  const { studentId, weekNumber: cumWeek, note } = shared;

  const supabase = getServiceClient();
  const { data: student } = await supabase
    .from("coaching_students")
    .select("id, name, coaching_start_date, mentor:coaching_mentors(name)")
    .eq("id", studentId)
    .maybeSingle();
  if (!student) return <Invalid />;

  const cycle = Math.floor((cumWeek - 1) / 4) + 1;
  const week = ((cumWeek - 1) % 4) + 1;

  const [{ data: restarts }, { data: cycleRows }, submission] = await Promise.all([
    supabase.from("coaching_restarts").select("cycle_number, start_date").eq("student_id", studentId),
    supabase.from("coaching_cycles").select("cycle_number, start_date, end_date").eq("student_id", studentId),
    getSubmissionByWeekAnyForm(studentId, cumWeek).catch(() => null as ConsultingSubmission | null),
  ]);

  const anchors = buildCycleAnchors(restarts, cycleRows);
  const start = student.coaching_start_date as string | null;
  const effectiveStart = start ? resolveCycleStart(start, cycle, anchors) : null;
  const weekStart = effectiveStart ? addDays(effectiveStart, (week - 1) * 7) : null;
  const weekEnd = weekStart ? addDays(weekStart, 6) : null;

  const state = weekStateFromWeek(cumWeek);
  const expectedType: ConsultingFormType = state.kind === "form" ? state.formType : "weekly";
  const typeLabel = FORM_TITLE[submission?.form_type ?? expectedType];
  const mentorName = (student as unknown as { mentor?: { name: string } | null }).mentor?.name || "";

  const html = noteToHtml(note);
  const fmtDot = (d: string | null) => (d || "").replace(/-/g, ".");
  const fields = submission ? fieldsFor(submission.form_type) : [];

  return (
    <main data-preview-root className="min-h-screen bg-white">
      <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-ink/10 bg-white/90 px-5 py-3 backdrop-blur">
        <div className="text-sm font-semibold text-ink/60">컨설팅 기록</div>
        <PrintButton />
      </div>

      <div className="preview-doc mx-auto max-w-[860px] px-4 py-6 sm:px-6 sm:py-8">
        <header className="preview-banner overflow-hidden rounded-3xl bg-gradient-to-r from-[#38bdf8] via-[#0ea5e9] to-[#0284c7] px-6 py-6 text-white shadow-lg shadow-[#0ea5e9]/25 sm:px-9 sm:py-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white ring-1 ring-white/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.jpg" alt="SKY MATE 로고" className="h-9 w-9 object-contain" />
              </div>
              <div>
                <div className="text-xl font-extrabold tracking-tight">SKY MATE</div>
                <div className="mt-0.5 text-[13px] font-medium text-white/70">
                  {typeLabel} 컨설팅 기록
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-extrabold sm:text-[26px]">{cumWeek}주차</div>
              <div className="mt-1.5 text-[12px] leading-relaxed text-white/70">
                코칭 {cycle}개월차
                {weekStart && weekEnd ? (
                  <>
                    <br />
                    {fmtDot(weekStart)} ~ {fmtDot(weekEnd)}
                  </>
                ) : null}
                {mentorName ? (
                  <>
                    <br />
                    담당 {mentorName} 멘토
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <div className="preview-body pt-7">
          <h1 className="text-3xl font-extrabold text-ink">
            {student.name} <span className="text-ink/30">·</span> {cumWeek}주차 컨설팅
          </h1>

          <section className="mt-6 print-avoid-break">
            <h2 className="mb-3 text-lg font-extrabold text-ink">컨설팅 내용 정리</h2>
            <div className="comment-card rounded-2xl border border-ink/10 bg-[#f8fafc] px-5 py-4">
              {isEmptyNoteHtml(html) ? (
                <p className="text-sm text-ink/40">작성된 내용이 없습니다.</p>
              ) : (
                <div className="rich-content" dangerouslySetInnerHTML={{ __html: html }} />
              )}
            </div>
          </section>

          {submission && (
            <section className="mt-8">
              <h2 className="mb-3 text-lg font-extrabold text-ink">학생 제출 내용 · {typeLabel}</h2>
              <div className="space-y-4">
                {fields.map((f) => {
                  if (f.type === "image") {
                    const imgs = submission.file_paths?.[f.key] || [];
                    if (!imgs.length) return null;
                    return (
                      <div key={f.key} className="preview-photos rounded-2xl border border-ink/10 px-5 py-4">
                        <div className="mb-2 text-[11px] font-semibold text-[#0284c7]">{f.label}</div>
                        <div className="flex flex-wrap gap-2">
                          {imgs.map((im) => (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              key={im.path}
                              src={im.url}
                              alt=""
                              className="max-h-64 rounded-xl border border-ink/10 object-contain"
                            />
                          ))}
                        </div>
                      </div>
                    );
                  }
                  const text = submission.answers?.[f.key];
                  if (!text) return null;
                  return (
                    <div key={f.key} className="print-avoid-break rounded-2xl border border-ink/10 px-5 py-4">
                      <div className="mb-1.5 text-[11px] font-semibold text-[#0284c7]">{f.label}</div>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink/80">{text}</p>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {!submission && (
            <section className="mt-8">
              <div className="rounded-2xl border border-ink/10 px-5 py-4 text-sm text-ink/45">
                이 주차에 제출된 학생 작성 내용이 없습니다.
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}

function Invalid() {
  return (
    <main className="grid min-h-screen place-items-center bg-cream px-4">
      <div className="w-full max-w-sm rounded-2xl border border-ink/5 bg-white p-8 text-center shadow-sm">
        <p className="text-lg font-bold text-ink">열 수 없는 링크예요</p>
        <p className="mt-2 text-sm leading-relaxed text-ink/55">
          링크가 만료됐거나 공유가 꺼져 있습니다.
          <br />
          담당 멘토에게 문의해주세요.
        </p>
      </div>
    </main>
  );
}
