"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { ReviewSet, ReviewAttempt, QuestionType } from "@/types";

// 손글씨(필기체) 폰트 — 응원 문구용 (layout.tsx 에서 Google Fonts 로 로드).
const handwritingFont = "'Nanum Pen Script', cursive";

const TYPE_LABEL: Record<QuestionType, string> = {
  multiple_choice: "객관식",
  ox: "OX",
  short_answer: "단답",
  essay: "서술형",
};

export function ReviewDetail({ set, attempts }: { set: ReviewSet; attempts: ReviewAttempt[] }) {
  const [copied, setCopied] = useState(false);
  const [openAttempt, setOpenAttempt] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const sheetRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/quiz/${set.code}` : "";
  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const saveSheet = async (a: ReviewAttempt) => {
    const node = sheetRefs.current[a.id];
    if (!node) return;
    setSavingId(a.id);
    try {
      const { toPng } = await import("html-to-image");
      // 손글씨 웹폰트가 로드된 뒤 캡처 (첫 저장 시 폰트 누락 방지)
      if (document.fonts?.ready) await document.fonts.ready;
      const dataUrl = await toPng(node, { backgroundColor: "#ffffff", pixelRatio: 2 });
      const dateStr = new Date(a.completed_at).toISOString().slice(0, 10);
      const link = document.createElement("a");
      link.download = `복습결과지_${(a.student_name || "학생").trim()}_${set.code}_${dateStr}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error(e);
      alert("이미지 저장에 실패했습니다. 화면 스크린샷으로 저장해 주세요.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-7">
      <div>
        <Link href="/mentor/review" className="text-sm text-ink/55 hover:text-indigo">← 복습 목록</Link>
        <h1 className="text-3xl font-extrabold text-gradient mt-2">{set.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="font-mono font-bold bg-indigo/10 text-indigo rounded-full px-2.5 py-1">{set.code}</span>
          {set.subject && <span className="bg-ink/5 text-ink/60 rounded-full px-2.5 py-1">{set.subject}</span>}
          <span className="text-ink/40 px-1">{new Date(set.createdAt).toLocaleString("ko-KR")}</span>
        </div>
      </div>

      {/* 링크 */}
      <div className="glass rounded-2xl p-5">
        <label className="text-[11px] font-semibold text-ink/55 uppercase tracking-[0.12em]">학생 공유 링크</label>
        <div className="mt-1.5 flex items-center gap-2">
          <input
            readOnly
            value={shareUrl}
            className="w-full rounded-xl border border-ink/10 px-3 py-2.5 text-sm bg-ink/[0.02] outline-none"
          />
          <button onClick={copyLink} className="btn-gradient rounded-xl px-4 py-2.5 text-sm font-semibold whitespace-nowrap">
            {copied ? "복사됨" : "링크 복사"}
          </button>
        </div>
        <p className="text-xs text-ink/45 mt-2">같은 링크로 언제든 다시 풀 수 있고, 풀 때마다 아래 응시 기록에 쌓입니다.</p>
      </div>

      {/* 세트 멘토 메모 */}
      {set.mentorNote && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
          <div className="text-xs font-bold text-amber-700 mb-1">🔒 멘토 메모 (전체)</div>
          {set.mentorNote}
        </div>
      )}

      {/* 응시 기록 */}
      <section className="space-y-3">
        <h2 className="text-base font-bold text-ink">응시 기록 <span className="text-ink/40">({attempts.length})</span></h2>
        {attempts.length === 0 ? (
          <p className="text-sm text-ink/45 py-6 text-center rounded-2xl bg-white border border-ink/5">아직 응시한 학생이 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {attempts.map((a) => (
              <div key={a.id} className="rounded-2xl bg-white border border-ink/5 shadow-sm overflow-hidden">
                <button
                  onClick={() => setOpenAttempt(openAttempt === a.id ? null : a.id)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-ink/[0.02]"
                >
                  <div>
                    <div className="font-bold text-ink">{a.student_name || "(이름 없음)"}</div>
                    <div className="text-xs text-ink/45 mt-0.5">{new Date(a.completed_at).toLocaleString("ko-KR")}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-extrabold text-gradient">{a.score_percent}점</span>
                    <span className="text-xs text-ink/50">{a.correct}/{a.total}</span>
                    <span className="text-ink/30 text-sm">{openAttempt === a.id ? "▲" : "▼"}</span>
                  </div>
                </button>
                {openAttempt === a.id && (
                  <div className="border-t border-ink/5 p-4 space-y-3 bg-ink/[0.01]">
                    <div className="flex justify-end">
                      <button
                        onClick={() => saveSheet(a)}
                        disabled={savingId === a.id}
                        className="btn-gradient rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60"
                      >
                        {savingId === a.id ? "저장 중…" : "📷 결과지 이미지 저장"}
                      </button>
                    </div>

                    {/* 캡처 대상 결과지 */}
                    <div
                      ref={(el) => { sheetRefs.current[a.id] = el; }}
                      className="rounded-2xl bg-white border border-ink/10 p-6 space-y-4"
                    >
                      <div className="flex items-start justify-between gap-4 border-b border-ink/10 pb-3">
                        <div>
                          <div className="text-xs tracking-[0.18em] text-indigo font-bold">SKY MATE 오늘의 복습 결과</div>
                          <div className="text-lg font-extrabold text-ink mt-0.5">{set.title}</div>
                          <div className="text-xs text-ink/50 mt-1">
                            {a.student_name || "(이름 없음)"} · {set.subject || "복습"} · {new Date(a.completed_at).toLocaleString("ko-KR")}
                          </div>
                          <div className="text-xs text-ink/60 mt-1">
                            복습지 코드: <span className="font-mono font-bold text-indigo">{set.code}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-3xl font-extrabold text-gradient leading-none">{a.score_percent}점</div>
                          <div className="text-xs text-ink/50 mt-1">{a.correct} / {a.total} 정답</div>
                        </div>
                      </div>

                      {a.result.map((it) => (
                        <div key={it.index} className={`rounded-xl border-l-4 bg-white p-3 text-sm ${it.isCorrect ? "border-emerald-400" : "border-rose"}`}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-semibold text-ink">{it.index + 1}. {it.question}</div>
                            <span className={`shrink-0 text-xs font-bold ${it.isCorrect ? "text-emerald-600" : "text-rose"}`}>
                              {it.isCorrect ? "○ 정답" : "✕ 오답"}
                            </span>
                          </div>
                          <div className="text-ink/60 mt-1">학생 답: {it.studentAnswer || "(무응답)"}</div>
                          {!it.isCorrect && <div className="text-emerald-700">정답: {it.correctAnswer}</div>}
                          {!it.isCorrect && it.explanation && (
                            <div className="text-ink/55 mt-1 rounded-lg bg-ink/[0.03] p-2">📘 해설: {it.explanation}</div>
                          )}
                          {it.feedback && <div className="text-ink/50 mt-1">💬 {it.feedback}</div>}
                        </div>
                      ))}

                      <div className="text-center pt-4 mt-2 border-t border-ink/10">
                        <div
                          style={{ fontFamily: handwritingFont }}
                          className="text-5xl text-indigo leading-tight"
                        >
                          오늘도 정말 고생 많았어요!
                        </div>
                        <div className="text-xs text-ink/50 mt-2">
                          SKY MATE 복습 결과지 · 복습지 코드 <span className="font-mono font-bold text-indigo">{set.code}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 문제 내용 (정답·멘토메모 포함) */}
      <section className="space-y-3">
        <h2 className="text-base font-bold text-ink">문제 내용 <span className="text-ink/40">({set.questions.length})</span></h2>
        {set.questions.map((q, i) => (
          <div key={i} className="rounded-2xl bg-white border border-ink/5 p-4 shadow-sm space-y-2">
            <span className="rounded-full bg-indigo/10 px-3 py-1 text-xs font-semibold text-indigo">
              {i + 1}. {TYPE_LABEL[q.type]} · {q.difficulty}
            </span>
            <p className="text-sm font-medium">{q.question}</p>
            {q.options.length > 0 && (
              <ul className="text-sm text-ink/60 list-disc pl-5">
                {q.options.map((o, oi) => (
                  <li key={oi} className={o === q.answer ? "text-emerald-700 font-semibold" : ""}>{o}</li>
                ))}
              </ul>
            )}
            <p className="text-sm text-emerald-700">정답: {q.answer}</p>
            {q.explanation && <p className="text-sm text-ink/55 rounded-lg bg-ink/[0.03] p-2">📘 {q.explanation}</p>}
            {q.mentorNote && (
              <p className="text-sm text-amber-900 rounded-lg bg-amber-50 ring-1 ring-amber-100 p-2">🔒 {q.mentorNote}</p>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
