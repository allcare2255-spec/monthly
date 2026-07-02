"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addDays, cumulativeWeek } from "@/lib/dates";

export type CycleInfo = {
  cycle: number;
  defaultStart: string;
  defaultEnd: string;
  weekProgress: number;
};

type Override = { start_date: string | null; end_date: string | null; memo: string | null };
type TStatus = "completed" | "active" | "upcoming" | "missed";

export function CycleCards({
  studentId,
  studentName,
  currentWeek,
  cycles,
  initialOverrides,
  today,
  monthlyDone,
}: {
  studentId: string;
  studentName: string;
  currentWeek: number;
  cycles: CycleInfo[];
  initialOverrides: Record<number, Override>;
  today: string;
  monthlyDone: number[];
}) {
  const [overrides, setOverrides] = useState<Record<number, Override>>(initialOverrides);

  function patchLocal(cycle: number, patch: Partial<Override>) {
    setOverrides((o) => {
      const base: Override = o[cycle] ?? { start_date: null, end_date: null, memo: null };
      return { ...o, [cycle]: { ...base, ...patch } };
    });
  }

  return (
    <div className="space-y-4">
      {cycles.map((c) => (
        <CycleCard
          key={c.cycle}
          studentId={studentId}
          studentName={studentName}
          currentWeek={currentWeek}
          info={c}
          override={overrides[c.cycle]}
          onSaved={(patch) => patchLocal(c.cycle, patch)}
          today={today}
          isMonthlyDone={monthlyDone.includes(c.cycle)}
          hasNextCycle={cycles.some((x) => x.cycle === c.cycle + 1)}
        />
      ))}
    </div>
  );
}

function fmt(d: string): string {
  const [, m, day] = d.split("-").map(Number);
  const dows = ["일", "월", "화", "수", "목", "금", "토"];
  const dow = dows[new Date(d + "T00:00:00Z").getUTCDay()];
  return `${m}/${day}(${dow})`;
}

function dStatus(winS: string, winE: string, today: string, done: boolean): TStatus {
  if (done) return "completed";
  if (today < winS) return "upcoming";
  if (today <= winE) return "active";
  return "missed";
}

function wStatus(wS: string, wE: string, today: string): TStatus {
  if (today > wE) return "completed";
  if (today >= wS) return "active";
  return "upcoming";
}

function StatusDot({ s }: { s: TStatus }) {
  const base = "w-3.5 h-3.5 rounded-full flex-shrink-0";
  if (s === "completed")
    return (
      <span className={`${base} bg-emerald-500 flex items-center justify-center`}>
        <span className="text-white text-[9px] font-bold leading-none">✓</span>
      </span>
    );
  if (s === "active") return <span className={`${base} bg-indigo ring-2 ring-indigo/25`} />;
  if (s === "missed") return <span className={`${base} border-2 border-sunset bg-sunset/5`} />;
  return <span className={`${base} border-2 border-ink/20 bg-white`} />;
}

function TimelineItem({
  s,
  label,
  dateRange,
  links,
}: {
  s: TStatus;
  label: string;
  dateRange: string;
  links?: { label: string; href: string }[];
}) {
  const textCls =
    s === "completed"
      ? "text-ink/50"
      : s === "active"
        ? "text-ink font-semibold"
        : s === "missed"
          ? "text-sunset"
          : "text-ink/38";

  return (
    <div className="flex items-start gap-3 py-2">
      <div className="mt-0.5 flex-shrink-0">
        <StatusDot s={s} />
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-sm leading-snug ${textCls}`}>
          {label}
          {s === "active" && (
            <span className="ml-1.5 inline-block align-middle text-[10px] font-semibold text-indigo bg-indigo/10 rounded-full px-1.5 py-0.5">
              진행 중
            </span>
          )}
          {s === "missed" && (
            <span className="ml-1.5 inline-block align-middle text-[10px] font-semibold text-sunset bg-sunset/10 rounded-full px-1.5 py-0.5">
              미완료
            </span>
          )}
        </div>
        <div className="text-xs text-ink/60 mt-0.5 font-medium">{dateRange}</div>
        {links && links.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`text-[11px] rounded-full px-2.5 py-0.5 font-semibold border transition ${
                  s === "upcoming"
                    ? "text-ink/30 border-ink/10 hover:bg-ink/5"
                    : "bg-indigo/10 text-indigo border-indigo/20 hover:bg-indigo/20"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CycleCard({
  studentId,
  studentName,
  currentWeek,
  info,
  override,
  onSaved,
  today,
  isMonthlyDone,
  hasNextCycle,
}: {
  studentId: string;
  studentName: string;
  currentWeek: number;
  info: CycleInfo;
  override?: Override;
  onSaved: (patch: Partial<Override>) => void;
  today: string;
  isMonthlyDone: boolean;
  hasNextCycle: boolean;
}) {
  const router = useRouter();
  const { cycle, defaultStart, defaultEnd, weekProgress } = info;

  const cycleFirstWeek = (cycle - 1) * 4 + 1;
  const cycleLastWeek = cycle * 4;
  const isCurrent = currentWeek >= cycleFirstWeek && currentWeek <= cycleLastWeek;

  // 이미 지나간 주차(누적 주차 < 현재 주차)의 계획표·레포트 뱃지는 회색 처리
  const weekBadgeCls = (cum: number) =>
    cum < currentWeek
      ? "bg-ink/5 text-ink/40 border-ink/10 hover:bg-ink/10"
      : "bg-indigo/10 text-indigo border-indigo/20 hover:bg-indigo/20";

  const shownStart = override?.start_date || defaultStart;
  const shownEnd = override?.end_date || defaultEnd;
  const memo = override?.memo || "";

  const [editingDate, setEditingDate] = useState(false);
  const [start, setStart] = useState(shownStart);
  const [end, setEnd] = useState(shownEnd);
  const [editingMemo, setEditingMemo] = useState(false);
  const [memoDraft, setMemoDraft] = useState(memo);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);

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

  // 타임라인 날짜 계산
  const cs = shownStart;
  const wS = [0, 1, 2, 3].map((i) => addDays(cs, i * 7)); // 주차 시작일 (월)
  const wE = wS.map((s) => addDays(s, 6));                  // 주차 종료일 (일)

  const preSat = addDays(cs, -2); // 코칭 시작 전 토요일
  const preSun = addDays(cs, -1); // 코칭 시작 전 일요일

  const mcSat = addDays(cs, 26);  // 4주차 마지막 토요일 (월간 컨설팅)
  const mcSun = addDays(cs, 27);  // 4주차 마지막 일요일 (= wE[3])

  const finalS = wE[3];           // 4주차 종료일 (일)
  const finalE = addDays(cs, 28); // 코칭 종료 다음 월요일

  // 각 항목 상태
  const preS: TStatus = today >= cs ? "completed" : today >= preSat ? "active" : "upcoming";
  const w1PlanSt = dStatus(preSat, wS[0], today, weekProgress >= 1);

  const weekSt = [0, 1, 2, 3].map((i) => wStatus(wS[i], wE[i], today));

  // 주차 전환 상태: weekProgress > i → i+1 주차 레포트 존재 (1-indexed max)
  const transSt = [0, 1, 2].map((i) =>
    dStatus(wE[i], wS[i + 1], today, weekProgress > i),
  );

  const mcSt: TStatus = today > mcSun ? "completed" : today >= mcSat ? "active" : "upcoming";

  const finalSt = dStatus(finalS, finalE, today, weekProgress >= 4 && isMonthlyDone);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-white border border-ink/5 p-5 shadow-sm hover:shadow-md transition">
      <div
        className={`absolute -right-12 -top-12 w-44 h-44 rounded-full bg-gradient-to-br ${
          cycle % 2 === 1
            ? "from-indigo/12 via-violet/10 to-fuchsia/12"
            : "from-fuchsia/12 via-rose/10 to-sunset/12"
        } blur-2xl pointer-events-none`}
      />

      {/* 헤더 */}
      <div className="relative mb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="text-[11px] uppercase tracking-[0.2em] text-indigo font-semibold">
              Coaching Month {cycle}
            </div>
            <div className="text-xl font-extrabold text-ink mt-0.5 flex items-center flex-wrap gap-2">
              {studentName} 코칭 {cycle}개월차
              {isCurrent && (
                <span className="inline-block px-2 py-0.5 rounded-full bg-fuchsia text-white font-bold text-[10px]">
                  {currentWeek}주차 진행 중
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex-shrink-0 text-xs text-ink/50 hover:text-ink font-medium border border-ink/15 rounded-lg px-2.5 py-1 transition hover:bg-ink/5"
          >
            {expanded ? "접기" : "펼치기"}
          </button>
        </div>

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
            <button
              onClick={() => {
                setMemoDraft(memo);
                setEditingMemo((v) => !v);
              }}
              className={`font-medium hover:underline ${memo ? "text-sunset" : "text-ink/55"}`}
            >
              메모{memo ? " ●" : ""}
            </button>
          </div>
        )}
      </div>

      {/* 메모 */}
      {!editingMemo && memo && (
        <div className="relative mb-4 rounded-xl bg-sunset/5 border border-sunset/20 px-3 py-2 text-sm text-ink/75 whitespace-pre-wrap">
          {memo}
        </div>
      )}
      {editingMemo && (
        <div className="relative mb-4">
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

      {/* 콤팩트 주차 버튼 */}
      <div className="border-t border-ink/5 pt-3 space-y-2">
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-[10px] text-ink/40 font-medium shrink-0 w-10">계획표</span>
          {[1, 2, 3, 4].map((w) => (
            <Link
              key={w}
              href={`/mentor/students/${studentId}/plan?cycle=${cycle}&week=${w}`}
              className={`text-[11px] rounded-full px-2.5 py-0.5 font-semibold border transition ${weekBadgeCls(cumulativeWeek(cycle, w))}`}
            >
              {cumulativeWeek(cycle, w)}주차 계획표
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-[10px] text-ink/40 font-medium shrink-0 w-10">레포트</span>
          {[1, 2, 3, 4].map((w) => (
            <Link
              key={w}
              href={`/mentor/students/${studentId}/weekly?cycle=${cycle}&week=${w}`}
              className={`text-[11px] rounded-full px-2.5 py-0.5 font-semibold border transition ${weekBadgeCls(cumulativeWeek(cycle, w))}`}
            >
              {cumulativeWeek(cycle, w)}주차 레포트
            </Link>
          ))}
          <Link
            href={`/mentor/students/${studentId}/monthly?cycle=${cycle}`}
            className="text-[11px] rounded-full px-2.5 py-0.5 font-semibold border bg-fuchsia/10 text-fuchsia border-fuchsia/20 hover:bg-fuchsia/20 transition"
          >
            {cycle}개월차 월간
          </Link>
        </div>
      </div>

      {/* 타임라인 (펼치기) */}
      {expanded && (
        <div className="relative pl-5 border-t border-ink/5 pt-1 mt-3">
          <div className="absolute left-[8px] top-4 bottom-3 w-px bg-ink/8" />

          {/* ① 사전 질문지 컨설팅 (1개월차만) */}
          {cycle === 1 && (
            <TimelineItem
              s={preS}
              label="사전 질문지 컨설팅"
              dateRange={`${fmt(preSat)} ~ ${fmt(preSun)}`}
            />
          )}

          {/* 1주차 주간 계획표 */}
          <TimelineItem
            s={w1PlanSt}
            label={`${cumulativeWeek(cycle, 1)}주차 주간 계획표`}
            dateRange={`${fmt(preSat)} ~ ${fmt(wS[0])}`}
            links={[
              {
                label: `${cumulativeWeek(cycle, 1)}주차 계획표`,
                href: `/mentor/students/${studentId}/plan?cycle=${cycle}&week=1`,
              },
            ]}
          />

          {/* ②~⑦ 1~3주차 코칭 + 레포트/계획표 전환 */}
          {[0, 1, 2].map((wi) => {
            const w = wi + 1;
            const cum = cumulativeWeek(cycle, w);
            return (
              <div key={wi}>
                <TimelineItem
                  s={weekSt[wi]}
                  label={`${cum}주차 코칭 진행 중`}
                  dateRange={`${fmt(wS[wi])} ~ ${fmt(wE[wi])}`}
                />
                <TimelineItem
                  s={transSt[wi]}
                  label={`${cum}주차 주간 레포트 + ${cum + 1}주차 주간 계획표`}
                  dateRange={`${fmt(wE[wi])} ~ ${fmt(wS[wi + 1])}`}
                  links={[
                    {
                      label: `${cum}주차 레포트`,
                      href: `/mentor/students/${studentId}/weekly?cycle=${cycle}&week=${w}`,
                    },
                    {
                      label: `${cum + 1}주차 계획표`,
                      href: `/mentor/students/${studentId}/plan?cycle=${cycle}&week=${w + 1}`,
                    },
                  ]}
                />
              </div>
            );
          })}

          {/* ⑧ 4주차 코칭 진행 중 */}
          <TimelineItem
            s={weekSt[3]}
            label={`${cumulativeWeek(cycle, 4)}주차 코칭 진행 중`}
            dateRange={`${fmt(wS[3])} ~ ${fmt(wE[3])}`}
          />

          {/* 월간 컨설팅 (연장 시에만 표시) */}
          {hasNextCycle && (
            <TimelineItem
              s={mcSt}
              label="월간 컨설팅"
              dateRange={`${fmt(mcSat)} ~ ${fmt(mcSun)}`}
            />
          )}

          {/* ⑨ 4주차 레포트 + 월간 레포트 */}
          <TimelineItem
            s={finalSt}
            label={`${cumulativeWeek(cycle, 4)}주차 주간 레포트 + ${cycle}개월차 월간 레포트`}
            dateRange={`${fmt(finalS)} ~ ${fmt(finalE)}`}
            links={[
              {
                label: `${cumulativeWeek(cycle, 4)}주차 레포트`,
                href: `/mentor/students/${studentId}/weekly?cycle=${cycle}&week=4`,
              },
              {
                label: `${cycle}개월차 월간 레포트`,
                href: `/mentor/students/${studentId}/monthly?cycle=${cycle}`,
              },
            ]}
          />
        </div>
      )}
    </div>
  );
}
