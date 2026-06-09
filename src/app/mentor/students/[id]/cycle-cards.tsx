"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cumulativeWeek } from "@/lib/dates";

export type CycleInfo = {
  cycle: number;
  defaultStart: string;
  defaultEnd: string;
  weekProgress: number;
};

type Override = { start_date: string | null; end_date: string | null; memo: string | null };

export function CycleCards({
  studentId,
  studentName,
  cycles,
  initialOverrides,
}: {
  studentId: string;
  studentName: string;
  cycles: CycleInfo[];
  initialOverrides: Record<number, Override>;
}) {
  const [overrides, setOverrides] = useState<Record<number, Override>>(initialOverrides);

  function patchLocal(cycle: number, patch: Partial<Override>) {
    setOverrides((o) => {
      const base: Override = o[cycle] ?? { start_date: null, end_date: null, memo: null };
      return { ...o, [cycle]: { ...base, ...patch } };
    });
  }

  return (
    <div className="space-y-3">
      {cycles.map((c) => (
        <CycleCard
          key={c.cycle}
          studentId={studentId}
          studentName={studentName}
          info={c}
          override={overrides[c.cycle]}
          onSaved={(patch) => patchLocal(c.cycle, patch)}
        />
      ))}
    </div>
  );
}

function CycleCard({
  studentId,
  studentName,
  info,
  override,
  onSaved,
}: {
  studentId: string;
  studentName: string;
  info: CycleInfo;
  override?: Override;
  onSaved: (patch: Partial<Override>) => void;
}) {
  const router = useRouter();
  const { cycle, defaultStart, defaultEnd, weekProgress } = info;

  const shownStart = override?.start_date || defaultStart;
  const shownEnd = override?.end_date || defaultEnd;
  const memo = override?.memo || "";

  const [editingDate, setEditingDate] = useState(false);
  const [start, setStart] = useState(shownStart);
  const [end, setEnd] = useState(shownEnd);

  const [editingMemo, setEditingMemo] = useState(false);
  const [memoDraft, setMemoDraft] = useState(memo);
  const [busy, setBusy] = useState(false);

  async function save(patch: Partial<Override>) {
    setBusy(true);
    const res = await fetch("/api/cycles", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ student_id: studentId, cycle_number: cycle, ...patch }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return alert(d.error || "저장 실패");
    }
    onSaved(patch);
    router.refresh();
    return true;
  }

  async function saveDate() {
    const ok = await save({ start_date: start, end_date: end });
    if (ok) setEditingDate(false);
  }
  async function saveMemo() {
    const ok = await save({ memo: memoDraft.trim() || null });
    if (ok) setEditingMemo(false);
  }
  async function deleteMemo() {
    const ok = await save({ memo: null });
    if (ok) {
      setMemoDraft("");
      setEditingMemo(false);
    }
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-white border border-ink/5 p-5 shadow-sm hover:shadow-md transition">
      <div className={`absolute -right-12 -top-12 w-44 h-44 rounded-full bg-gradient-to-br ${
        cycle % 2 === 1
          ? "from-indigo/12 via-violet/10 to-fuchsia/12"
          : "from-fuchsia/12 via-rose/10 to-sunset/12"
      } blur-2xl pointer-events-none`} />
      <div className="relative flex items-center justify-between flex-wrap gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.2em] text-indigo font-semibold">
            Coaching Month {cycle}
          </div>
          {/* [수정 9-1] 타이틀에 학생 이름 포함 */}
          <div className="text-xl font-extrabold text-ink mt-1">
            {studentName} 코칭 {cycle}개월차
          </div>

          {/* [수정 9-2] 날짜 + 수정 버튼 */}
          {editingDate ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="rounded-lg border border-ink/15 px-2 py-1 text-xs outline-none focus:border-indigo"
              />
              <span className="text-ink/40 text-xs">~</span>
              <input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="rounded-lg border border-ink/15 px-2 py-1 text-xs outline-none focus:border-indigo"
              />
              <button onClick={saveDate} disabled={busy} className="text-xs font-semibold text-indigo hover:underline">
                저장
              </button>
              <button
                onClick={() => {
                  setStart(shownStart);
                  setEnd(shownEnd);
                  setEditingDate(false);
                }}
                className="text-xs text-ink/50 hover:underline"
              >
                취소
              </button>
            </div>
          ) : (
            <div className="text-xs text-ink/55 mt-0.5 flex items-center gap-2 flex-wrap">
              <span>
                {shownStart} ~ {shownEnd}
              </span>
              <button onClick={() => setEditingDate(true)} className="text-indigo hover:underline font-medium">
                수정
              </button>
              {/* [수정 2] 메모 버튼을 날짜·수정 옆으로 이동 */}
              <button
                onClick={() => {
                  setMemoDraft(memo);
                  setEditingMemo((v) => !v);
                }}
                className={`font-medium hover:underline ${memo ? "text-sunset" : "text-ink/55"}`}
              >
                메모{memo ? " ●" : ""}
              </button>
              <span className="inline-block px-1.5 py-0.5 rounded-full bg-ink/5 text-ink/60 text-[10px]">
                {weekProgress}/4 주차 진행
              </span>
            </div>
          )}
        </div>

        {/* [수정 1] 주차 버튼 2줄(계획표/레포트) + 월간 레포트 */}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="flex flex-col gap-1.5 items-end">
            <div className="flex gap-1.5 flex-wrap justify-end">
              {[1, 2, 3, 4].map((w) => (
                <Link
                  key={w}
                  href={`/mentor/students/${studentId}/plan?cycle=${cycle}&week=${w}`}
                  className={`text-xs rounded-full px-2.5 py-1 font-semibold border transition ${
                    w <= weekProgress
                      ? "bg-gradient-to-r from-indigo/15 to-violet/15 text-indigo border-indigo/25 hover:from-indigo/25 hover:to-violet/25"
                      : "text-ink/50 border-ink/10 hover:bg-indigo/5"
                  }`}
                >
                  {cumulativeWeek(cycle, w)}주차 주간 계획표
                </Link>
              ))}
            </div>
            <div className="flex gap-1.5 flex-wrap justify-end">
              {[1, 2, 3, 4].map((w) => (
                <Link
                  key={w}
                  href={`/mentor/students/${studentId}/weekly?cycle=${cycle}&week=${w}`}
                  className={`text-xs rounded-full px-2.5 py-1 font-semibold border transition ${
                    w <= weekProgress
                      ? "bg-gradient-to-r from-indigo/15 to-violet/15 text-indigo border-indigo/25 hover:from-indigo/25 hover:to-violet/25"
                      : "text-ink/50 border-ink/10 hover:bg-indigo/5"
                  }`}
                >
                  {cumulativeWeek(cycle, w)}주차 주간 레포트
                </Link>
              ))}
            </div>
          </div>
          <Link
            href={`/mentor/students/${studentId}/monthly?cycle=${cycle}`}
            className="text-xs rounded-full px-3 py-1 font-semibold bg-gradient-to-r from-fuchsia to-rose text-white border border-transparent hover:brightness-110 transition shadow-sm shadow-fuchsia/30"
          >
            {cycle}개월차 월간 레포트
          </Link>
        </div>
      </div>

      {/* [수정 9-3] 메모 표시 / 편집 */}
      {!editingMemo && memo && (
        <div className="relative mt-3 rounded-xl bg-sunset/5 border border-sunset/20 px-3 py-2 text-sm text-ink/75 whitespace-pre-wrap">
          {memo}
        </div>
      )}
      {editingMemo && (
        <div className="relative mt-3">
          <textarea
            rows={3}
            value={memoDraft}
            onChange={(e) => setMemoDraft(e.target.value)}
            placeholder="이 월차에 대한 자유 메모를 작성하세요"
            className="w-full rounded-xl border border-ink/10 px-3 py-2 text-sm outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15 transition"
          />
          <div className="flex justify-end gap-2 mt-2">
            {memo && (
              <button onClick={deleteMemo} disabled={busy} className="text-xs text-rose hover:underline mr-auto">
                삭제
              </button>
            )}
            <button onClick={() => setEditingMemo(false)} className="text-xs text-ink/50 hover:underline">
              취소
            </button>
            <button onClick={saveMemo} disabled={busy} className="text-xs font-semibold text-indigo hover:underline">
              저장
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
