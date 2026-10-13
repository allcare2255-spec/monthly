"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * 컨설팅 화면 상단 고정 섹션 — 중간고사 결과.
 *
 * 멘토가 줌 화면공유 중에 학생과 함께 정리하는 칸이다. 주차가 아니라 시험 단위로
 * 저장하므로, 같은 시험 기간이면 다음 주차 화면에서도 같은 내용이 그대로 보인다.
 * 성적표 사진은 폼으로 받지 않고 단톡방으로 모으기로 해서, 여기서도 글만 적는다.
 */
export function MidtermPanel({
  studentId,
  examKey,
  examLabel,
  initialContent,
  reportReceived,
  savable,
}: {
  studentId: string;
  examKey: string;
  examLabel: string;
  initialContent: string;
  /** 학생이 폼에서 고른 성적표 수령 여부 ("예" / "아니오" / 미응답이면 null) */
  reportReceived: string | null;
  savable: boolean;
}) {
  const [content, setContent] = useState(initialContent);
  const [state, setState] = useState<SaveState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const savedRef = useRef(initialContent);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(
    async (value: string) => {
      if (!savable) return;
      if (value === savedRef.current) return;
      setState("saving");
      try {
        const res = await fetch("/api/consulting/midterm", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ student_id: studentId, exam_key: examKey, content: value }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || "저장 실패");
        }
        savedRef.current = value;
        setErrorMsg("");
        setState("saved");
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "저장 실패");
        setState("error");
      }
    },
    [studentId, examKey, savable],
  );

  const dirty = content !== savedRef.current;

  // 메모와 같은 0.8초 디바운스 자동 저장
  useEffect(() => {
    if (!savable || !dirty) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => save(content), 800);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [content, dirty, save, savable]);

  return (
    <section className="rounded-2xl border border-fuchsia/25 bg-gradient-to-br from-fuchsia/[0.05] to-indigo/[0.04] shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-fuchsia/15 px-5 py-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-bold text-ink">중간고사 결과</h2>
          <span className="rounded-full bg-fuchsia/10 px-2.5 py-1 text-[11px] font-semibold text-fuchsia">
            {examLabel}
          </span>
          <ReportBadge value={reportReceived} />
        </div>
        <div className="flex items-center gap-2">
          <SaveBadge state={state} savable={savable} error={errorMsg} />
          <button
            onClick={() => save(content)}
            disabled={!savable || !dirty}
            className="text-[11px] font-semibold text-indigo hover:underline disabled:text-ink/25 disabled:no-underline"
          >
            지금 저장
          </button>
        </div>
      </div>
      <div className="p-5">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={!savable}
          rows={6}
          className="w-full resize-y rounded-xl border border-ink/10 bg-white px-3.5 py-3 text-sm leading-relaxed text-ink outline-none transition focus:border-fuchsia focus:ring-2 focus:ring-fuchsia/15 disabled:bg-ink/[0.03]"
          placeholder={"국어 — 점수 / 등급 (직전 대비)\n수학 —\n영어 —\n탐구 —\n\n잘된 점 :\n아쉬운 점과 원인 :\n다음 시험까지 할 것 :"}
        />
        <p className="mt-2 text-[11px] text-ink/45">
          시험 단위로 저장돼서, 다음 주차 컨설팅 화면에서도 이 내용이 그대로 보입니다. 성적표 사진은 단톡방에서 확인하세요.
        </p>
      </div>
    </section>
  );
}

/** 학생이 폼에서 고른 성적표 수령 여부 */
function ReportBadge({ value }: { value: string | null }) {
  if (!value) {
    return (
      <span className="rounded-full bg-ink/[0.06] px-2.5 py-1 text-[11px] font-semibold text-ink/45">
        성적표 여부 미응답
      </span>
    );
  }
  const yes = value === "예";
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        yes ? "bg-indigo/10 text-indigo" : "bg-ink/[0.06] text-ink/55"
      }`}
    >
      성적표 받음 · {value}
    </span>
  );
}

function SaveBadge({
  state,
  savable,
  error,
}: {
  state: SaveState;
  savable: boolean;
  error: string;
}) {
  if (!savable) {
    return <span className="text-[11px] font-semibold text-ink/35">저장 불가</span>;
  }
  if (state === "saving") return <span className="text-[11px] font-semibold text-ink/45">저장 중…</span>;
  if (state === "saved") return <span className="text-[11px] font-semibold text-emerald-600">저장됨</span>;
  if (state === "error") {
    return <span className="text-[11px] font-semibold text-rose" title={error}>저장 실패</span>;
  }
  return <span className="text-[11px] font-semibold text-ink/35">자동 저장</span>;
}
