"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import type {
  PublicReviewQuiz,
  PublicReviewQuestion,
  PublicClozePart,
  GradeResult,
  GradedItem,
} from "@/types";

// 답안 상태: 일반 문항 = 문자열, 복합형(cloze) = 칸별 문자열 배열.
// 단어 배열 칸은 고른 카드 번호(중복 단어 구분용)를 따로 들고 있다가 문자열로 합친다.
type Answer = string | string[];
type OrderSel = Record<string, number[]>; // key = `${문항}-${칸}`

const CIRCLED = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮";
const circled = (i: number) => CIRCLED[i] ?? `(${i + 1})`;

const draftKey = (code: string) => `skymate-quiz-draft-${code}`;

function emptyAnswers(quiz: PublicReviewQuiz): Answer[] {
  return quiz.questions.map((q) =>
    q.type === "cloze" ? new Array((q.parts ?? []).length).fill("") : ""
  );
}

function isFilled(q: PublicReviewQuestion, a: Answer | undefined): boolean {
  if (q.type === "cloze") {
    const arr = Array.isArray(a) ? a : [];
    return (q.parts ?? []).every((_, i) => (arr[i] ?? "").trim() !== "");
  }
  return typeof a === "string" && a.trim() !== "";
}

/** **굵게**, __밑줄__ 만 지원하는 아주 작은 마크업. 줄바꿈은 그대로. */
function Rich({ text }: { text: string }) {
  const tokens = text.split(/(\*\*.+?\*\*|__.+?__)/g);
  return (
    <>
      {tokens.map((t, i) => {
        if (t.startsWith("**") && t.endsWith("**")) return <b key={i}>{t.slice(2, -2)}</b>;
        if (t.startsWith("__") && t.endsWith("__"))
          return (
            <span key={i} className="underline decoration-2 underline-offset-4 font-bold">
              {t.slice(2, -2)}
            </span>
          );
        return <Fragment key={i}>{t}</Fragment>;
      })}
    </>
  );
}

// ── 칸 컴포넌트 ─────────────────────────────────────────────

const INPUT_W: Record<"s" | "m" | "l", string> = {
  s: "w-[5.5rem]",
  m: "w-[8.5rem]",
  l: "w-[12rem]",
};

/** 다음 입력칸으로 포커스 이동 (키보드 "다음"/엔터). */
function focusNextInput(from: HTMLInputElement) {
  const all = Array.from(document.querySelectorAll<HTMLInputElement>("input[data-quiz-input]"));
  const i = all.indexOf(from);
  const next = all[i + 1];
  if (next) next.focus();
  else from.blur();
}

function InputSlot({
  part,
  value,
  onChange,
  num,
  showNum,
}: {
  part: Extract<PublicClozePart, { kind: "input" }>;
  value: string;
  onChange: (v: string) => void;
  num: number;
  showNum: boolean;
}) {
  return (
    <span className="inline-flex items-baseline gap-0.5 mx-0.5 align-baseline max-w-full">
      {showNum && <span className="text-[11px] text-indigo font-bold mr-0.5">{circled(num)}</span>}
      {part.prefix && <b className="text-ink">{part.prefix}</b>}
      <input
        data-quiz-input
        className={`${INPUT_W[part.size]} max-w-[70vw] rounded-lg border-2 px-2 py-1 text-base leading-6 outline-none transition ${
          value.trim()
            ? "border-indigo/40 bg-indigo/[0.04]"
            : "border-dashed border-ink/25 bg-white"
        } focus:border-indigo focus:ring-2 focus:ring-indigo/20`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            e.preventDefault();
            focusNextInput(e.currentTarget);
          }
        }}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="next"
        aria-label={`빈칸 ${num + 1}`}
      />
    </span>
  );
}

function PickSlot({
  part,
  value,
  onChange,
}: {
  part: Extract<PublicClozePart, { kind: "pick" }>;
  value: string;
  onChange: (v: string) => void;
}) {
  const isOX = part.options.length === 2 && part.options[0] === "O" && part.options[1] === "X";
  return (
    <span className="inline-flex flex-wrap items-center gap-1 mx-0.5 align-middle">
      {part.options.map((opt) => {
        const on = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(on ? "" : opt)}
            className={`rounded-lg border-2 font-semibold transition select-none ${
              isOX ? "min-w-[3.25rem] px-3 py-1.5 text-lg" : "px-2.5 py-1 text-[15px]"
            } ${
              on
                ? "border-indigo bg-indigo text-white shadow-sm"
                : "border-ink/15 bg-white text-ink/80 active:bg-ink/5"
            }`}
            aria-pressed={on}
          >
            {opt}
          </button>
        );
      })}
    </span>
  );
}

function OrderSlot({
  part,
  sel,
  onChange,
}: {
  part: Extract<PublicClozePart, { kind: "order" }>;
  sel: number[];
  onChange: (sel: number[]) => void;
}) {
  const used = new Set(sel);
  return (
    <span className="block my-2 rounded-xl border-2 border-indigo/15 bg-indigo/[0.03] p-2.5 space-y-2.5">
      <span className="flex flex-wrap gap-1.5 min-h-[44px] rounded-lg border-2 border-dashed border-ink/20 bg-white p-1.5">
        {sel.length === 0 && (
          <span className="text-sm text-ink/35 self-center px-1">아래 단어를 순서대로 눌러 주세요</span>
        )}
        {sel.map((ti, k) => (
          <button
            key={`${ti}-${k}`}
            type="button"
            onClick={() => onChange(sel.filter((_, j) => j !== k))}
            className="rounded-lg bg-indigo text-white px-2.5 py-1.5 text-[15px] font-medium select-none active:opacity-80"
            title="눌러서 빼기"
          >
            {part.tokens[ti]}
          </button>
        ))}
      </span>
      <span className={`flex flex-wrap gap-1.5 ${sel.length === part.tokens.length ? "hidden" : ""}`}>
        {part.tokens.map((t, ti) =>
          used.has(ti) ? (
            <span
              key={ti}
              className="rounded-lg border-2 border-transparent bg-ink/[0.04] px-2.5 py-1.5 text-[15px] text-transparent select-none"
              aria-hidden
            >
              {t}
            </span>
          ) : (
            <button
              key={ti}
              type="button"
              onClick={() => onChange([...sel, ti])}
              className="rounded-lg border-2 border-ink/15 bg-white px-2.5 py-1.5 text-[15px] font-medium text-ink select-none active:bg-indigo/10"
            >
              {t}
            </button>
          )
        )}
      </span>
      {sel.length > 0 && (
        <span className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onChange(sel.slice(0, -1))}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-ink/60 bg-white border border-ink/10"
          >
            ↶ 하나 빼기
          </button>
          <button
            type="button"
            onClick={() => onChange([])}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-rose bg-white border border-rose/20"
          >
            처음부터
          </button>
        </span>
      )}
    </span>
  );
}

// ── 문항 카드 ─────────────────────────────────────────────

function ClozeBody({
  q,
  qi,
  value,
  orderSel,
  setPart,
  setOrder,
}: {
  q: PublicReviewQuestion;
  qi: number;
  value: string[];
  orderSel: OrderSel;
  setPart: (pi: number, v: string) => void;
  setOrder: (pi: number, sel: number[]) => void;
}) {
  const parts = q.parts ?? [];
  const inputCount = parts.filter((p) => p.kind === "input").length;
  const segs = (q.body ?? "").split(/(\{\{\d+\}\})/g);
  // 입력칸 번호(①②…)는 입력칸끼리만 센다
  const inputNos = parts.reduce<number[]>((acc, p, pi) => {
    acc[pi] = p.kind === "input" ? acc.filter((n) => n >= 0).length : -1;
    return acc;
  }, []);
  return (
    <div className="text-[15px] sm:text-base leading-[2.6] text-ink whitespace-pre-wrap break-words">
      {segs.map((s, i) => {
        const m = /^\{\{(\d+)\}\}$/.exec(s);
        if (!m) return <Rich key={i} text={s} />;
        const pi = Number(m[1]);
        const p = parts[pi];
        if (!p) return null;
        if (p.kind === "input") {
          return (
            <InputSlot
              key={i}
              part={p}
              value={value[pi] ?? ""}
              onChange={(v) => setPart(pi, v)}
              num={inputNos[pi]}
              showNum={inputCount > 1}
            />
          );
        }
        if (p.kind === "pick")
          return <PickSlot key={i} part={p} value={value[pi] ?? ""} onChange={(v) => setPart(pi, v)} />;
        return (
          <OrderSlot
            key={i}
            part={p}
            sel={orderSel[`${qi}-${pi}`] ?? []}
            onChange={(sel) => setOrder(pi, sel)}
          />
        );
      })}
    </div>
  );
}

function QuestionCard({
  q,
  qi,
  answer,
  orderSel,
  onAnswer,
  onOrder,
}: {
  q: PublicReviewQuestion;
  qi: number;
  answer: Answer;
  orderSel: OrderSel;
  onAnswer: (a: Answer) => void;
  onOrder: (pi: number, sel: number[]) => void;
}) {
  const filled = isFilled(q, answer);
  return (
    <div
      id={`q-${qi}`}
      className={`scroll-mt-24 rounded-2xl bg-white border p-4 sm:p-5 shadow-sm space-y-3 ${
        filled ? "border-indigo/20" : "border-ink/5"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={`shrink-0 grid place-items-center w-8 h-8 rounded-full text-sm font-extrabold ${
            filled ? "bg-indigo text-white" : "bg-indigo/10 text-indigo"
          }`}
        >
          {qi + 1}
        </span>
        <div className="min-w-0 pt-1">
          {q.tag && <div className="text-[11px] font-semibold text-ink/40 mb-0.5">{q.tag}</div>}
          <p className="text-[15px] sm:text-base font-bold text-ink leading-snug">{q.question}</p>
        </div>
      </div>

      {q.context && (
        <p className="rounded-xl bg-ink/[0.035] px-3 py-2.5 text-sm text-ink/60 leading-relaxed whitespace-pre-wrap">
          {q.context}
        </p>
      )}

      {q.table && q.table.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-center border-collapse">
            <thead>
              <tr>
                {q.table[0].map((c, ci) => (
                  <th key={ci} className="border border-ink/15 bg-indigo/[0.06] px-2 py-1.5 font-semibold">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {q.table.slice(1).map((row, ri) => (
                <tr key={ri}>
                  {row.map((c, ci) => (
                    <td key={ci} className="border border-ink/15 px-2 py-1.5">
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {q.type === "cloze" && (
        <ClozeBody
          q={q}
          qi={qi}
          value={Array.isArray(answer) ? answer : []}
          orderSel={orderSel}
          setPart={(pi, v) => {
            const arr = Array.isArray(answer) ? [...answer] : [];
            arr[pi] = v;
            onAnswer(arr);
          }}
          setOrder={onOrder}
        />
      )}

      {(q.type === "multiple_choice" || q.type === "ox") && q.options.length > 0 && (
        <div className={q.type === "ox" ? "flex gap-2" : "space-y-2"}>
          {q.options.map((opt, oi) => {
            const on = answer === opt;
            return (
              <button
                key={oi}
                type="button"
                onClick={() => onAnswer(on ? "" : opt)}
                className={`w-full text-left rounded-xl border-2 px-3.5 py-3 text-[15px] transition ${
                  q.type === "ox" ? "text-center text-xl font-bold" : ""
                } ${on ? "border-indigo bg-indigo/5 font-semibold" : "border-ink/10 active:bg-ink/5"}`}
                aria-pressed={on}
              >
                {opt}
              </button>
            );
          })}
        </div>
      )}

      {q.type === "short_answer" && (
        <input
          data-quiz-input
          className="w-full rounded-xl border-2 border-ink/10 px-3 py-2.5 text-base focus:border-indigo focus:ring-2 focus:ring-indigo/20 outline-none"
          placeholder="답을 입력하세요"
          value={typeof answer === "string" ? answer : ""}
          onChange={(e) => onAnswer(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              focusNextInput(e.currentTarget);
            }
          }}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="next"
        />
      )}

      {q.type === "essay" && (
        <textarea
          className="w-full rounded-xl border-2 border-ink/10 px-3 py-2.5 text-base focus:border-indigo focus:ring-2 focus:ring-indigo/20 outline-none"
          rows={4}
          placeholder="답을 작성하세요"
          value={typeof answer === "string" ? answer : ""}
          onChange={(e) => onAnswer(e.target.value)}
        />
      )}
    </div>
  );
}

// ── 결과 카드 ─────────────────────────────────────────────

function ResultItem({ it }: { it: GradedItem }) {
  const partial = !it.isCorrect && it.score > 0;
  return (
    <div
      className={`rounded-2xl bg-white border-l-4 p-4 shadow-sm border border-ink/5 ${
        it.isCorrect ? "border-l-emerald-400" : partial ? "border-l-amber-400" : "border-l-rose"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold">
          {it.index + 1}. {it.isCorrect ? "✅ 정답" : partial ? "🟡 부분 정답" : "❌ 오답"}
        </span>
        {(it.type === "essay" || partial) && (
          <span className="text-xs text-ink/40">점수 {Math.round(it.score * 100)}%</span>
        )}
      </div>
      <p className="mt-2 text-sm font-medium">{it.question}</p>
      {it.detail && <p className="mt-1 text-sm text-ink/55 leading-relaxed">{it.detail}</p>}

      {it.parts && it.parts.length > 0 ? (
        <div className="mt-2 space-y-1.5">
          {it.parts.map((p, pi) => (
            <div
              key={pi}
              className={`rounded-lg px-2.5 py-1.5 text-sm ${p.ok ? "bg-emerald-50" : "bg-rose/[0.06]"}`}
            >
              <span className="font-bold mr-1.5">{it.parts!.length > 1 ? circled(pi) : ""}</span>
              <span className={p.ok ? "text-emerald-700 font-medium" : "text-ink/70"}>
                {p.ok ? "✓ " : "✗ "}
                {p.student || "(무응답)"}
              </span>
              {!p.ok && <span className="text-emerald-700 font-semibold"> → {p.correct}</span>}
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-2 space-y-1 text-sm">
          <p className="text-ink/60">
            내 답: <span className="font-medium">{it.studentAnswer || "(무응답)"}</span>
          </p>
          {!it.isCorrect && <p className="text-emerald-700">정답: {it.correctAnswer}</p>}
        </div>
      )}
      {it.type === "essay" && it.feedback && <p className="mt-1 text-sm text-ink/50">💬 {it.feedback}</p>}
      {it.explanation && (
        <p className="mt-2 rounded-lg bg-ink/[0.03] p-2 text-sm text-ink/60">📘 {it.explanation}</p>
      )}
    </div>
  );
}

// ── 페이지 ─────────────────────────────────────────────

export default function StudentQuizPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code || "").toUpperCase();

  const [quiz, setQuiz] = useState<PublicReviewQuiz | null>(null);
  const [name, setName] = useState("");
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [orderSel, setOrderSel] = useState<OrderSel>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<GradeResult | null>(null);
  const [wrongOnly, setWrongOnly] = useState(false);
  const [savingImg, setSavingImg] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const restored = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/review/quiz/${code}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "불러오기 실패");
        const qz: PublicReviewQuiz = json.quiz;
        setQuiz(qz);
        let ans = emptyAnswers(qz);
        let sel: OrderSel = {};
        let nm = qz.studentName || "";
        // 풀던 답안 복원 (새로고침·앱 전환에도 안 날아가게)
        try {
          const raw = localStorage.getItem(draftKey(code));
          if (raw) {
            const d = JSON.parse(raw);
            if (Array.isArray(d.answers) && d.answers.length === ans.length) {
              ans = ans.map((a, i) =>
                Array.isArray(a)
                  ? a.map((_, j) => (Array.isArray(d.answers[i]) ? (d.answers[i][j] ?? "") : ""))
                  : typeof d.answers[i] === "string"
                    ? d.answers[i]
                    : ""
              );
              if (d.orderSel && typeof d.orderSel === "object") sel = d.orderSel;
            }
            if (typeof d.name === "string" && d.name.trim()) nm = d.name;
          }
        } catch {}
        setAnswers(ans);
        setOrderSel(sel);
        setName(nm);
        restored.current = true;
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [code]);

  // 자동 임시저장
  useEffect(() => {
    if (!restored.current || result) return;
    try {
      localStorage.setItem(draftKey(code), JSON.stringify({ name, answers, orderSel }));
    } catch {}
  }, [code, name, answers, orderSel, result]);

  const filledFlags = useMemo(
    () => (quiz ? quiz.questions.map((q, i) => isFilled(q, answers[i])) : []),
    [quiz, answers]
  );
  const filledCount = filledFlags.filter(Boolean).length;
  const total = quiz?.questions.length ?? 0;

  const setAnswer = (i: number, val: Answer) =>
    setAnswers((prev) => prev.map((a, idx) => (idx === i ? val : a)));

  const setOrder = (qi: number, pi: number, sel: number[]) => {
    const q = quiz?.questions[qi];
    const p = q?.parts?.[pi];
    if (!p || p.kind !== "order") return;
    setOrderSel((prev) => ({ ...prev, [`${qi}-${pi}`]: sel }));
    setAnswers((prev) =>
      prev.map((a, idx) => {
        if (idx !== qi) return a;
        const arr = Array.isArray(a) ? [...a] : [];
        arr[pi] = sel.map((t) => p.tokens[t]).join(" ");
        return arr;
      })
    );
  };

  const goTo = (i: number) =>
    document.getElementById(`q-${i}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

  const submit = async () => {
    if (!name.trim()) {
      setError("이름을 입력해주세요.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const empty = filledFlags.map((f, i) => (f ? -1 : i + 1)).filter((n) => n > 0);
    if (
      empty.length > 0 &&
      !window.confirm(
        `아직 다 못 푼 문제가 있어요: ${empty.slice(0, 12).join(", ")}${empty.length > 12 ? " …" : ""}번\n그래도 제출할까요?`
      )
    ) {
      goTo(empty[0] - 1);
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
      try {
        localStorage.removeItem(draftKey(code));
      } catch {}
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const retry = () => {
    if (!quiz) return;
    setAnswers(emptyAnswers(quiz));
    setOrderSel({});
    setResult(null);
    setWrongOnly(false);
    window.scrollTo({ top: 0 });
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

  const shownItems = result ? result.items.filter((it) => !wrongOnly || !it.isCorrect) : [];

  return (
    <div className="min-h-screen mesh-bg-soft">
      <div className={`max-w-2xl mx-auto px-3 sm:px-4 pt-6 ${!result && quiz ? "pb-32" : "pb-10"}`}>
        <div className="text-center mb-5">
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
                <h1 className="mt-2 text-3xl font-extrabold text-gradient">{result.scorePercent}점</h1>
                <p className="text-ink/60 mt-1">
                  {name && <span className="font-semibold text-ink/80">{name}</span>} · {quiz?.title}
                </p>
                <p className="text-ink/50 text-sm mt-0.5">
                  {result.total}문제 중 {result.correct}개 완전 정답
                </p>
              </div>

              {shownItems.map((it) => (
                <ResultItem key={it.index} it={it} />
              ))}
              {wrongOnly && shownItems.length === 0 && (
                <p className="text-center text-sm text-ink/50 py-6">틀린 문제가 없어요! 🎉</p>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setWrongOnly((v) => !v)}
                className="flex-1 rounded-xl border-2 border-indigo/20 bg-white py-3 text-sm font-semibold text-indigo"
              >
                {wrongOnly ? "전체 보기" : "틀린 문제만 보기"}
              </button>
              <button
                onClick={retry}
                className="flex-1 rounded-xl border-2 border-ink/10 bg-white py-3 text-sm font-semibold text-ink/70"
              >
                다시 풀기
              </button>
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
              {quiz.subject && (
                <span className="inline-block rounded-full bg-indigo/10 text-indigo text-xs font-bold px-2.5 py-1 mb-2">
                  {quiz.subject}
                </span>
              )}
              <h1 className="text-xl font-extrabold text-ink leading-snug">{quiz.title}</h1>
              <p className="text-xs text-ink/40 mt-1">
                총 {total}문제 · 코드 {quiz.code} · 풀던 답은 자동 저장돼요
              </p>
              <div className="mt-4">
                <label className="text-[11px] font-semibold text-ink/55 uppercase tracking-[0.12em]">
                  이름
                </label>
                <input
                  className="mt-1.5 w-full rounded-xl border-2 border-ink/10 px-3 py-2.5 text-base focus:border-indigo focus:ring-2 focus:ring-indigo/20 outline-none bg-white"
                  placeholder="이름을 입력하세요 (결과에 기록됩니다)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              </div>
              <ul className="mt-3 text-xs text-ink/50 space-y-0.5 leading-relaxed">
                <li>• 빈칸은 눌러서 입력하고, 키보드의 ‘다음’으로 다음 칸으로 넘어가요.</li>
                <li>• [ A / B ] 고르기와 O·X는 버튼을 눌러 선택해요.</li>
                <li>• 단어 배열은 단어 카드를 순서대로 누르면 돼요. 잘못 누르면 위 카드를 눌러 빼요.</li>
                <li>• 띄어쓰기·대소문자·괄호는 채점에 영향을 주지 않아요.</li>
              </ul>
            </div>

            {quiz.questions.map((q, i) => (
              <QuestionCard
                key={i}
                q={q}
                qi={i}
                answer={answers[i] ?? ""}
                orderSel={orderSel}
                onAnswer={(a) => setAnswer(i, a)}
                onOrder={(pi, sel) => setOrder(i, pi, sel)}
              />
            ))}

            {error && <p className="text-sm text-rose text-center">{error}</p>}
          </div>
        )}
      </div>

      {/* 하단 고정: 진행률 + 제출 */}
      {!result && quiz && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink/10 bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
          <div className="max-w-2xl mx-auto px-3 sm:px-4 py-2.5 space-y-2">
            <div className="flex gap-1 overflow-x-auto [scrollbar-width:none]">
              {filledFlags.map((f, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => goTo(i)}
                  className={`shrink-0 w-7 h-7 rounded-md text-[11px] font-bold ${
                    f ? "bg-indigo text-white" : "bg-ink/[0.06] text-ink/50"
                  }`}
                  aria-label={`${i + 1}번으로 이동`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button
              onClick={submit}
              disabled={submitting}
              className="btn-gradient w-full rounded-xl py-3 text-base font-semibold"
            >
              {submitting ? "채점 중…" : `제출하고 채점받기 (${filledCount}/${total})`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
