"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import type { PublicReviewQuiz, GradeResult } from "@/types";

export default function StudentQuizPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code || "").toUpperCase();

  const [quiz, setQuiz] = useState<PublicReviewQuiz | null>(null);
  const [name, setName] = useState("");
  const [answers, setAnswers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<GradeResult | null>(null);
  const [savingImg, setSavingImg] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/review/quiz/${code}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "불러오기 실패");
        setQuiz(json.quiz);
        setAnswers(new Array(json.quiz.questions.length).fill(""));
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [code]);

  const setAnswer = (i: number, val: string) =>
    setAnswers((prev) => prev.map((a, idx) => (idx === i ? val : a)));

  const submit = async () => {
    if (!name.trim()) {
      setError("이름을 입력해주세요.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/review/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, answers, name: name.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "채점 실패");
      setResult(json.result);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const saveImage = async () => {
    if (!resultRef.current) return;
    setSavingImg(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(resultRef.current, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
      });
      const a = document.createElement("a");
      a.download = `복습결과_${name.trim() || "결과"}_${code}.png`;
      a.href = dataUrl;
      a.click();
    } catch (e) {
      console.error(e);
      setError("이미지 저장에 실패했습니다. 스크린샷으로 저장해주세요.");
    } finally {
      setSavingImg(false);
    }
  };

  return (
    <div className="min-h-screen mesh-bg-soft">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="text-center mb-6">
          <div className="text-[11px] uppercase tracking-[0.25em] text-indigo font-semibold">
            SKY MATE Review
          </div>
          <div className="text-lg font-extrabold text-gradient mt-1">복습 테스트</div>
        </div>

        {loading && <p className="text-center text-ink/50 py-20">불러오는 중…</p>}

        {!loading && error && !quiz && (
          <div className="glass rounded-2xl p-8 text-center">
            <p className="text-rose font-semibold">{error}</p>
            <p className="text-ink/50 text-sm mt-2">코드를 다시 확인해주세요.</p>
          </div>
        )}

        {/* ── 채점 결과 ── */}
        {result && (
          <div className="space-y-4">
            <div ref={resultRef} className="space-y-4 bg-white rounded-2xl p-1">
              <div className="rounded-2xl bg-gradient-to-br from-indigo/10 via-violet/5 to-fuchsia/10 border border-indigo/15 p-6 text-center">
                <div className="text-5xl">
                  {result.scorePercent >= 80 ? "🎉" : result.scorePercent >= 50 ? "👍" : "💪"}
                </div>
                <h1 className="mt-2 text-3xl font-extrabold text-gradient">
                  {result.scorePercent}점
                </h1>
                <p className="text-ink/60 mt-1">
                  {name && <span className="font-semibold text-ink/80">{name}</span>} ·{" "}
                  {quiz?.title} · {result.total}문제 중 {result.correct}개 정답
                </p>
              </div>

              {result.items.map((it) => (
                <div
                  key={it.index}
                  className={`rounded-2xl bg-white border-l-4 p-4 shadow-sm border border-ink/5 ${
                    it.isCorrect ? "border-l-emerald-400" : "border-l-rose"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold">
                      {it.index + 1}. {it.isCorrect ? "✅ 정답" : "❌ 오답"}
                    </span>
                    {it.type === "essay" && (
                      <span className="text-xs text-ink/40">점수 {Math.round(it.score * 100)}%</span>
                    )}
                  </div>
                  <p className="mt-2 text-sm font-medium">{it.question}</p>
                  <div className="mt-2 space-y-1 text-sm">
                    <p className="text-ink/60">
                      내 답: <span className="font-medium">{it.studentAnswer || "(무응답)"}</span>
                    </p>
                    {!it.isCorrect && <p className="text-emerald-700">정답: {it.correctAnswer}</p>}
                    {it.feedback && <p className="text-ink/50">💬 {it.feedback}</p>}
                    {it.explanation && (
                      <p className="rounded-lg bg-ink/[0.03] p-2 text-ink/60">📘 {it.explanation}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={saveImage}
              disabled={savingImg}
              className="btn-gradient w-full rounded-xl py-3 font-semibold"
            >
              {savingImg ? "저장 중…" : "📸 결과 이미지로 저장 (멘토님께 전송)"}
            </button>
            <p className="text-center text-xs text-ink/45">
              저장한 이미지를 멘토 선생님께 카카오톡으로 보내주세요.
            </p>
          </div>
        )}

        {/* ── 풀이 화면 ── */}
        {!result && quiz && (
          <div className="space-y-4">
            <div className="glass rounded-2xl p-5">
              <h1 className="text-xl font-extrabold text-ink">{quiz.title}</h1>
              <p className="text-xs text-ink/40 mt-0.5">코드 {quiz.code}</p>
            </div>

            <div className="glass rounded-2xl p-5">
              <label className="text-[11px] font-semibold text-ink/55 uppercase tracking-[0.12em]">
                이름
              </label>
              <input
                className="mt-1.5 w-full rounded-xl border border-ink/10 px-3 py-2.5 text-sm focus:border-indigo focus:ring-2 focus:ring-indigo/20 outline-none"
                placeholder="이름을 입력하세요 (결과에 기록됩니다)"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {quiz.questions.map((q, i) => (
              <div key={i} className="rounded-2xl bg-white border border-ink/5 p-5 shadow-sm space-y-3">
                <p className="text-sm font-bold text-ink">
                  {i + 1}. {q.question}
                </p>

                {(q.type === "multiple_choice" || q.type === "ox") && q.options.length > 0 && (
                  <div className="space-y-2">
                    {q.options.map((opt, oi) => (
                      <label
                        key={oi}
                        className={`flex cursor-pointer items-center gap-2 rounded-xl border p-2.5 text-sm transition ${
                          answers[i] === opt
                            ? "border-indigo bg-indigo/5 font-medium"
                            : "border-ink/10 hover:border-ink/20"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`q-${i}`}
                          checked={answers[i] === opt}
                          onChange={() => setAnswer(i, opt)}
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                )}

                {q.type === "short_answer" && (
                  <input
                    className="w-full rounded-xl border border-ink/10 px-3 py-2.5 text-sm focus:border-indigo focus:ring-2 focus:ring-indigo/20 outline-none"
                    placeholder="답을 입력하세요"
                    value={answers[i]}
                    onChange={(e) => setAnswer(i, e.target.value)}
                  />
                )}

                {q.type === "essay" && (
                  <textarea
                    className="w-full rounded-xl border border-ink/10 px-3 py-2.5 text-sm focus:border-indigo focus:ring-2 focus:ring-indigo/20 outline-none"
                    rows={4}
                    placeholder="답을 작성하세요"
                    value={answers[i]}
                    onChange={(e) => setAnswer(i, e.target.value)}
                  />
                )}
              </div>
            ))}

            {error && <p className="text-sm text-rose text-center">{error}</p>}

            <button
              onClick={submit}
              disabled={submitting}
              className="btn-gradient w-full rounded-xl py-3.5 text-base font-semibold"
            >
              {submitting ? "채점 중…" : "제출하고 채점받기"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
