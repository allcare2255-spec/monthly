"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { weekStateFromWeek } from "@/lib/consulting/week";
import { FORM_TITLE } from "@/lib/consulting/forms";

/**
 * 이 주차의 컨설팅 내용을 다른 주차로 옮기는 버튼 + 창.
 * 학생이 폼을 늦게 내거나 링크를 잘못 눌러 주차가 어긋났을 때 멘토/관리자가 직접 바로잡는다.
 */
export function MoveWeekButton({
  studentId,
  cumWeek,
  cycle,
  hasSubmission,
  submissionLabel,
  hasNote,
}: {
  studentId: string;
  cumWeek: number;
  cycle: number;
  hasSubmission: boolean;
  submissionLabel: string;
  hasNote: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [moveSubmission, setMoveSubmission] = useState(hasSubmission);
  const [moveNote, setMoveNote] = useState(hasNote);
  const [toWeek, setToWeek] = useState(cumWeek > 1 ? cumWeek - 1 : cumWeek + 1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // 창을 열 때마다 처음 상태로 되돌린다 (앞서 실패한 안내가 남지 않도록)
  useEffect(() => {
    if (!open) return;
    setMoveSubmission(hasSubmission);
    setMoveNote(hasNote);
    setToWeek(cumWeek > 1 ? cumWeek - 1 : cumWeek + 1);
    setError("");
  }, [open, hasSubmission, hasNote, cumWeek]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const nothingToMove = !hasSubmission && !hasNote;

  // 고를 수 있는 주차 — 이번 달과 다음 달까지 (1주차부터 이어서 보여준다)
  const weekOptions: number[] = [];
  for (let w = 1; w <= cycle * 4 + 4; w++) if (w !== cumWeek) weekOptions.push(w);

  const targetState = weekStateFromWeek(toWeek);
  const currentState = weekStateFromWeek(cumWeek);
  const typeMismatch =
    moveSubmission &&
    targetState.kind === "form" &&
    currentState.kind === "form" &&
    targetState.formType !== currentState.formType;

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/consulting/move-week", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          student_id: studentId,
          from_week: cumWeek,
          to_week: toWeek,
          move_submission: moveSubmission,
          move_note: moveNote,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "이동하지 못했습니다.");
      setOpen(false);
      // 옮긴 내용을 바로 볼 수 있도록 대상 주차 화면으로 이동한다
      const toCycle = Math.ceil(toWeek / 4);
      router.push(
        `/mentor/students/${studentId}/consult?cycle=${toCycle}&week=${toWeek - (toCycle - 1) * 4}`,
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "이동하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={nothingToMove}
        title={nothingToMove ? "이 주차에는 옮길 내용이 없습니다." : "이 주차 내용을 다른 주차로 옮기기"}
        className="ml-2 px-4 py-2 rounded-lg text-sm font-semibold text-ink/60 hover:bg-indigo/5 disabled:text-ink/25 disabled:hover:bg-transparent disabled:cursor-not-allowed"
      >
        주차 이동
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-ink">{cumWeek}주차 내용 옮기기</h2>
            <p className="mt-1 text-xs text-ink/50">
              옮길 곳에 이미 내용이 있으면 이동하지 않고 알려드립니다.
            </p>

            <div className="mt-5 space-y-2">
              <label
                className={`flex items-start gap-2.5 rounded-xl border p-3 text-sm ${
                  hasSubmission
                    ? "border-ink/10 cursor-pointer hover:bg-indigo/[0.03]"
                    : "border-ink/5 text-ink/35"
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-0.5"
                  disabled={!hasSubmission}
                  checked={moveSubmission}
                  onChange={(e) => setMoveSubmission(e.target.checked)}
                />
                <span>
                  <span className="font-semibold">학생 제출 내용</span>
                  <span className="block text-xs text-ink/45">
                    {hasSubmission ? submissionLabel : "이 주차에는 제출된 폼이 없습니다."}
                  </span>
                </span>
              </label>

              <label
                className={`flex items-start gap-2.5 rounded-xl border p-3 text-sm ${
                  hasNote
                    ? "border-ink/10 cursor-pointer hover:bg-indigo/[0.03]"
                    : "border-ink/5 text-ink/35"
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-0.5"
                  disabled={!hasNote}
                  checked={moveNote}
                  onChange={(e) => setMoveNote(e.target.checked)}
                />
                <span>
                  <span className="font-semibold">컨설팅 내용 정리</span>
                  <span className="block text-xs text-ink/45">
                    {hasNote ? "멘토가 작성한 정리 내용" : "이 주차에는 작성된 내용이 없습니다."}
                  </span>
                </span>
              </label>
            </div>

            <div className="mt-5">
              <label className="text-xs font-semibold text-ink/60">어느 주차로 옮길까요?</label>
              <select
                value={toWeek}
                onChange={(e) => setToWeek(Number(e.target.value))}
                className="mt-1.5 w-full rounded-xl border border-ink/10 px-3 py-2 text-sm"
              >
                {weekOptions.map((w) => (
                  <option key={w} value={w}>
                    {w}주차 ({Math.ceil(w / 4)}개월차)
                  </option>
                ))}
              </select>
            </div>

            {typeMismatch && targetState.kind === "form" && currentState.kind === "form" && (
              <p className="mt-3 rounded-xl bg-sunset/10 px-3 py-2 text-xs text-ink/70">
                {toWeek}주차는 원래 {FORM_TITLE[targetState.formType]} 주차인데, 옮기는 폼은{" "}
                {FORM_TITLE[currentState.formType]}입니다. 그대로 옮겨도 되지만 주차 표기를 한 번
                확인해주세요.
              </p>
            )}

            {error && (
              <p className="mt-3 rounded-xl bg-rose/10 px-3 py-2 text-xs font-semibold text-rose">
                {error}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-ink/60 hover:bg-ink/5"
              >
                취소
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={busy || (!moveSubmission && !moveNote)}
                className="btn-gradient rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-40"
              >
                {busy ? "옮기는 중…" : `${toWeek}주차로 옮기기`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
