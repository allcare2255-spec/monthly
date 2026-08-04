"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fieldsFor, FORM_TITLE } from "@/lib/consulting/forms";
import type { ConsultingSubmission, ConsultingFormType } from "@/types";

type SaveState = "idle" | "saving" | "saved" | "error";

export function ConsultWorkspace({
  studentId,
  studentName,
  mentorName,
  cumWeek,
  cycle,
  weekStart,
  weekEnd,
  submission,
  expectedType,
  initialNote,
  noteSavable,
}: {
  studentId: string;
  studentName: string;
  mentorName: string;
  cumWeek: number;
  cycle: number;
  weekStart: string | null;
  weekEnd: string | null;
  submission: ConsultingSubmission | null;
  expectedType: ConsultingFormType;
  initialNote: string;
  noteSavable: boolean;
}) {
  const [note, setNote] = useState(initialNote);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [preview, setPreview] = useState(false);

  // 저장한 마지막 값 — 이 값과 같으면 자동 저장을 건너뛴다
  const savedRef = useRef(initialNote);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(
    async (value: string) => {
      if (!noteSavable) return;
      if (value === savedRef.current) return;
      setSaveState("saving");
      try {
        const res = await fetch("/api/consulting/note", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ student_id: studentId, week_number: cumWeek, note: value }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || "저장 실패");
        }
        savedRef.current = value;
        setErrorMsg("");
        setSaveState("saved");
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "저장 실패");
        setSaveState("error");
      }
    },
    [studentId, cumWeek, noteSavable],
  );

  // 0.8초 디바운스 자동 저장
  useEffect(() => {
    if (!noteSavable) return;
    if (note === savedRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => save(note), 800);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [note, save, noteSavable]);

  // 저장 안 된 채로 페이지를 떠나려 할 때 경고
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (note !== savedRef.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [note]);

  // 이 페이지에서만 Shell 폭 제한 해제 (좌우 여백 축소 → 2단을 넓게)
  useEffect(() => {
    document.body.classList.add("consult-page");
    return () => document.body.classList.remove("consult-page");
  }, []);

  useEffect(() => {
    if (preview) document.body.classList.add("preview-active");
    else document.body.classList.remove("preview-active");
    return () => document.body.classList.remove("preview-active");
  }, [preview]);

  const typeLabel = FORM_TITLE[submission?.form_type ?? expectedType];

  return (
    <>
      {/* 좌: 학생 제출 폼 / 우: 멘토 메모 — 화면 공유용 2단 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start no-print">
        <SubmissionPanel submission={submission} typeLabel={typeLabel} cumWeek={cumWeek} />

        <section className="rounded-2xl bg-white border border-ink/5 shadow-sm lg:sticky lg:top-4">
          <div className="flex items-center justify-between gap-3 border-b border-ink/5 px-5 py-3.5">
            <h2 className="text-base font-bold text-ink">컨설팅 내용 정리</h2>
            <div className="flex items-center gap-2">
              <SaveBadge state={saveState} savable={noteSavable} error={errorMsg} />
              <button
                onClick={() => setPreview(true)}
                className="btn-gradient rounded-xl px-3.5 py-1.5 text-xs font-semibold"
              >
                PDF로 저장
              </button>
            </div>
          </div>
          <div className="p-5">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => save(note)}
              disabled={!noteSavable}
              placeholder={`${cumWeek}주차 컨설팅 내용을 작성하세요.\n\n· 학생 답변을 보며 짚어준 것\n· 다음 주까지의 약속\n· 특이사항`}
              className="w-full min-h-[520px] resize-y rounded-xl border border-ink/10 px-4 py-3 text-sm leading-relaxed outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15 transition disabled:bg-ink/[0.03] disabled:text-ink/40"
            />
            <div className="mt-2 flex items-center justify-between text-[11px] text-ink/45">
              <span>작성하면 자동 저장됩니다.</span>
              <button
                onClick={() => save(note)}
                disabled={!noteSavable || note === savedRef.current}
                className="font-semibold text-indigo hover:underline disabled:text-ink/25 disabled:no-underline"
              >
                지금 저장
              </button>
            </div>
          </div>
        </section>
      </div>

      {preview && (
        <ConsultPreview
          studentName={studentName}
          mentorName={mentorName}
          cumWeek={cumWeek}
          cycle={cycle}
          weekStart={weekStart}
          weekEnd={weekEnd}
          submission={submission}
          typeLabel={typeLabel}
          note={note}
          onClose={() => setPreview(false)}
        />
      )}
    </>
  );
}

function SaveBadge({ state, savable, error }: { state: SaveState; savable: boolean; error: string }) {
  if (!savable) return <span className="text-[11px] text-sunset font-semibold">저장 불가</span>;
  if (state === "saving") return <span className="text-[11px] text-ink/45">저장 중…</span>;
  if (state === "saved") return <span className="text-[11px] text-emerald-600 font-semibold">저장됨</span>;
  if (state === "error")
    return <span className="text-[11px] text-rose font-semibold" title={error}>저장 실패</span>;
  return null;
}

function SubmissionPanel({
  submission,
  typeLabel,
  cumWeek,
}: {
  submission: ConsultingSubmission | null;
  typeLabel: string;
  cumWeek: number;
}) {
  return (
    <section className="rounded-2xl bg-white border border-ink/5 shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-ink/5 px-5 py-3.5">
        <h2 className="text-base font-bold text-ink">학생 제출 내용</h2>
        <span className="rounded-full bg-indigo/10 text-indigo px-2.5 py-1 text-[11px] font-semibold">
          {typeLabel}
        </span>
      </div>
      <div className="p-5">
        {submission ? (
          <SubmissionBody submission={submission} />
        ) : (
          <p className="py-16 text-center text-sm text-ink/45">
            아직 학생이 {cumWeek}주차 {typeLabel}을(를) 제출하지 않았어요.
          </p>
        )}
      </div>
    </section>
  );
}

function SubmissionBody({ submission }: { submission: ConsultingSubmission }) {
  const fields = fieldsFor(submission.form_type);
  return (
    <div className="space-y-5">
      {fields.map((f) => {
        if (f.type === "image") {
          const imgs = submission.file_paths?.[f.key] || [];
          if (!imgs.length) return null;
          return (
            <Block key={f.key} label={f.label}>
              <div className="flex flex-wrap gap-2">
                {imgs.map((im) => (
                  <a key={im.path} href={im.url} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={im.url}
                      alt=""
                      className="h-40 w-40 rounded-xl object-cover border border-ink/10 hover:ring-2 hover:ring-indigo/30 transition"
                    />
                  </a>
                ))}
              </div>
            </Block>
          );
        }
        const text = submission.answers?.[f.key];
        if (!text) return null;
        return (
          <Block key={f.key} label={f.label}>
            <p className="text-sm text-ink/80 whitespace-pre-wrap leading-relaxed">{text}</p>
          </Block>
        );
      })}
    </div>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-indigo font-semibold mb-1.5">{label}</div>
      {children}
    </div>
  );
}

/** PDF 저장용 미리보기 — 주간/월간 레포트와 동일한 인쇄 패턴 (window.print) */
function ConsultPreview({
  studentName,
  mentorName,
  cumWeek,
  cycle,
  weekStart,
  weekEnd,
  submission,
  typeLabel,
  note,
  onClose,
}: {
  studentName: string;
  mentorName: string;
  cumWeek: number;
  cycle: number;
  weekStart: string | null;
  weekEnd: string | null;
  submission: ConsultingSubmission | null;
  typeLabel: string;
  note: string;
  onClose: () => void;
}) {
  const [preparing, setPreparing] = useState(false);

  async function handleSavePdf() {
    setPreparing(true);
    try {
      // 미리보기 안의 이미지 디코딩 완료까지 대기 → 인쇄 중 멈춤 방지
      const root = document.querySelector("[data-preview-root]");
      if (root) {
        const imgs = Array.from(root.querySelectorAll("img"));
        await Promise.all(
          imgs.map((img) =>
            img.complete
              ? img.decode().catch(() => {})
              : new Promise<void>((res) => {
                  img.onload = () => res();
                  img.onerror = () => res();
                }),
          ),
        );
      }
    } finally {
      setPreparing(false);
    }

    const fileName = `${studentName} ${cumWeek}주차 컨설팅 기록`
      .replace(/[\\/:*?"<>|]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const prevTitle = document.title;
    document.title = fileName;
    const restore = () => {
      document.title = prevTitle;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    window.print();
  }

  const fmtDot = (d: string | null) => (d || "").replace(/-/g, ".");
  const fields = submission ? fieldsFor(submission.form_type) : [];

  return (
    <div data-preview-root className="fixed inset-0 z-50 overflow-auto bg-white">
      <div className="preview-actions no-print sticky top-0 z-10 flex items-center justify-between gap-3 bg-white/90 backdrop-blur border-b border-ink/10 px-5 py-3">
        <button
          onClick={onClose}
          className="rounded-xl border border-ink/15 px-4 py-2 text-sm font-semibold text-ink/70 hover:bg-ink/5 transition"
        >
          ← 닫기
        </button>
        <div className="text-sm font-semibold text-ink/60">컨설팅 기록 미리보기</div>
        <button
          onClick={handleSavePdf}
          disabled={preparing}
          className="btn-gradient rounded-xl font-semibold px-5 py-2.5 disabled:opacity-60"
        >
          {preparing ? "준비 중..." : "PDF로 저장"}
        </button>
      </div>

      <div className="preview-doc mx-auto max-w-[860px] px-4 sm:px-6 py-6 sm:py-8">
        <header className="preview-banner overflow-hidden rounded-3xl bg-gradient-to-r from-[#38bdf8] via-[#0ea5e9] to-[#0284c7] px-6 py-6 sm:px-9 sm:py-8 text-white shadow-lg shadow-[#0ea5e9]/25">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white ring-1 ring-white/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.jpg" alt="SKY MATE 로고" className="h-9 w-9 object-contain" />
              </div>
              <div>
                <div className="text-xl font-extrabold tracking-tight">SKY MATE</div>
                <div className="mt-0.5 text-[13px] font-medium text-white/70">{typeLabel} 컨설팅 기록</div>
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
            {studentName} <span className="text-ink/30">·</span> {cumWeek}주차 컨설팅
          </h1>

          <section className="mt-6 print-avoid-break">
            <h2 className="text-lg font-extrabold text-ink mb-3">컨설팅 내용 정리</h2>
            <div className="comment-card rounded-2xl border border-ink/10 bg-[#f8fafc] px-5 py-4">
              {note.trim() ? (
                <p className="text-sm text-ink/85 whitespace-pre-wrap leading-relaxed">{note}</p>
              ) : (
                <p className="text-sm text-ink/40">작성된 메모가 없습니다.</p>
              )}
            </div>
          </section>

          {submission && (
            <section className="mt-8">
              <h2 className="text-lg font-extrabold text-ink mb-3">학생 제출 내용 · {typeLabel}</h2>
              <div className="space-y-4">
                {fields.map((f) => {
                  if (f.type === "image") {
                    const imgs = submission.file_paths?.[f.key] || [];
                    if (!imgs.length) return null;
                    return (
                      <div
                        key={f.key}
                        className="preview-photos rounded-2xl border border-ink/10 px-5 py-4"
                      >
                        <div className="text-[11px] font-semibold text-[#0284c7] mb-2">{f.label}</div>
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
                    <div
                      key={f.key}
                      className="print-avoid-break rounded-2xl border border-ink/10 px-5 py-4"
                    >
                      <div className="text-[11px] font-semibold text-[#0284c7] mb-1.5">{f.label}</div>
                      <p className="text-sm text-ink/80 whitespace-pre-wrap leading-relaxed">{text}</p>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
