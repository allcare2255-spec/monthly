"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DayData, MonthlyReport, WeeklyReport } from "@/types";
import { addDays, hmToMinutes } from "@/lib/dates";

// 주간 레포트(완성 미리보기)와 통일한 섹션/지표 라벨 서식
const SECTION_LABEL = "text-[12px] font-bold uppercase tracking-[0.12em] text-ink/55";

const STATUS_COLOR: Record<string, string> = {
  submitted: "#0ea5e9",   // 하늘색 (정상 인증)
  missed: "#ec4899",      // 진한 분홍 (미제출)
  paused: "#94A3B8",      // slate (일시 정지 — 중립)
  empty: "#E5E7EB",       // gray-200 (미입력 — 중립)
};

// 표시용 날짜 포맷 "2026-06-01" → "2026.06.01"
const fmtDot = (d: string) => (d || "").replace(/-/g, ".");

export function MonthlyReportView({
  studentId,
  studentName,
  highSchool,
  mentorName,
  cycle,
  cycleStart,
  cycleEnd,
  weeklies,
  initialMonthly,
}: {
  studentId: string;
  studentName: string;
  highSchool: string | null;
  mentorName: string;
  cycle: number;
  cycleStart: string;
  cycleEnd: string;
  weeklies: WeeklyReport[];
  initialMonthly: MonthlyReport | null;
}) {
  const [monthly, setMonthly] = useState<MonthlyReport | null>(initialMonthly);

  useEffect(() => {
    if (monthly) return;
    fetch(`/api/reports/monthly?student_id=${studentId}&cycle=${cycle}`)
      .then((r) => r.json())
      .then((d) => setMonthly(d.report));
  }, [monthly, studentId, cycle]);

  async function patchMonthly(patch: Partial<MonthlyReport>) {
    if (!monthly) return;
    setMonthly({ ...monthly, ...patch });
    await fetch("/api/reports/monthly", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: monthly.id, student_id: studentId, ...patch }),
    });
  }

  // PDF 저장 — 파일명 자동 설정: "홍길동 코칭 2개월차 월간 레포트"
  function handleSavePdf() {
    const fileName = `${studentName} 코칭 ${cycle}개월차 월간 레포트`
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

  // 28일 → 빈 자리 채워서 통합
  const allDays: DayData[] = useMemo(() => {
    const dates = Array.from({ length: 28 }, (_, i) => addDays(cycleStart, i));
    const map = new Map<string, DayData>();
    weeklies.forEach((w) =>
      w.day_data.forEach((d) => {
        map.set(d.date, d);
      }),
    );
    return dates.map(
      (d) =>
        map.get(d) || {
          date: d,
          wake_up_time: null,
          study_minutes: null,
          memo: null,
          status: "missed",
        },
    );
  }, [cycleStart, weeklies]);

  const hasData = weeklies.length > 0;

  // 통계
  const stats = useMemo(() => {
    const counted = allDays.filter((d) => d.status !== "paused" && hasDataForDay(d));
    const submitted = allDays.filter((d) => d.status === "submitted").length;
    const totalForRate = allDays.filter((d) => d.status !== "paused").length;
    const studyMins = counted
      .map((d) => d.study_minutes || 0)
      .filter((m) => m > 0);
    const wakeMins = counted
      .map((d) => hmToMinutes(d.wake_up_time))
      .filter((m): m is number => m != null);
    const avgStudy = studyMins.length ? Math.round(studyMins.reduce((s, m) => s + m, 0) / studyMins.length) : 0;
    const avgWake = wakeMins.length ? Math.round(wakeMins.reduce((s, m) => s + m, 0) / wakeMins.length) : null;
    return {
      submitted,
      total: totalForRate,
      taskRate: totalForRate ? Math.round((submitted / totalForRate) * 100) : 0,
      avgStudy,
      avgWake:
        avgWake != null
          ? `${String(Math.floor(avgWake / 60)).padStart(2, "0")}:${String(avgWake % 60).padStart(2, "0")}`
          : "-",
    };
  }, [allDays]);

  // 주차별 과제 완료율
  const weekRates = useMemo(() => {
    return [1, 2, 3, 4].map((w) => {
      const wk = weeklies.find((x) => x.week_number === w);
      if (!wk) return { week: `${w}주차`, rate: 0, hasData: false };
      const counted = wk.day_data.filter((d) => d.status !== "paused");
      const submitted = wk.day_data.filter((d) => d.status === "submitted").length;
      return {
        week: `${w}주차`,
        rate: counted.length ? Math.round((submitted / counted.length) * 100) : 0,
        hasData: true,
      };
    });
  }, [weeklies]);

  // 일별 순공시간 추세
  const studyTrend = useMemo(
    () =>
      allDays.map((d, i) => ({
        idx: i + 1,
        day: d.date.slice(5),
        hours: (d.study_minutes || 0) / 60,
      })),
    [allDays],
  );

  // 배너 우측 기간 타이틀 (년/월)
  const [periodYear, periodMonth] = (cycleStart || "").split("-");
  const periodTitle = periodYear && periodMonth ? `${periodYear}년 ${Number(periodMonth)}월` : "";

  return (
    <>
      {/* 인쇄 버튼 */}
      <div className="no-print flex justify-end">
        <button
          onClick={handleSavePdf}
          className="btn-gradient rounded-xl font-semibold px-5 py-2.5"
        >
          PDF로 저장
        </button>
      </div>

      <div data-preview-root>
        <div className="preview-doc mx-auto max-w-[860px]">
          {/* 상단 브랜드 헤더 배너 (상단: 로고 / 하단: 학생명 좌 · 기간 우) */}
          <header className="preview-banner overflow-hidden rounded-3xl bg-gradient-to-r from-[#38bdf8] via-[#0ea5e9] to-[#0284c7] px-6 py-6 sm:px-9 sm:py-8 text-white shadow-lg shadow-[#0ea5e9]/25">
            {/* 상단: 심볼 로고 + 브랜드명 + 부제목 */}
            <div className="flex items-center gap-3.5">
              <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white ring-1 ring-white/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.jpg" alt="SKY MATE 로고" className="h-9 w-9 object-contain" />
              </div>
              <div>
                <div className="text-xl font-extrabold tracking-tight">SKY MATE</div>
                <div className="mt-0.5 text-[13px] font-medium text-white/70">월간 학습코칭 레포트</div>
              </div>
            </div>

            {/* 하단: 학생명(좌) + 날짜·기간·담당 멘토(우) */}
            <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-[12px] font-semibold tracking-[0.06em] text-white/80">
                  코칭 {cycle}개월차
                </div>
                <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-[34px]">
                  {studentName} 학생
                </h1>
                {highSchool && (
                  <div className="mt-1.5 text-[13px] font-medium text-white/70">{highSchool}</div>
                )}
              </div>
              <div className="text-right">
                <div className="text-2xl font-extrabold sm:text-[26px]">{periodTitle}</div>
                <div className="mt-1.5 text-[12px] leading-relaxed text-white/70">
                  <div>기간: {fmtDot(cycleStart)} ~ {fmtDot(cycleEnd)}</div>
                  <div>담당 멘토: {mentorName || "-"}</div>
                </div>
              </div>
            </div>
          </header>

          {/* 본문 (인쇄 시 좌우/하단 여백 — 배너만 풀블리드) */}
          <div className="preview-body">
            {/* 통계 요약 — 파스텔 스탯 카드 */}
            <div className="grid grid-cols-1 gap-4 pt-7 mb-8 sm:grid-cols-3 sm:pt-8">
              <PreviewStat label="월 평균 기상 시간" value={stats.avgWake} />
              <PreviewStat label="월 평균 순공 시간" value={<StudyTimeValue minutes={stats.avgStudy} />} />
              <PreviewStat label="과제 완료율" value={`${stats.taskRate}%`} />
            </div>

            {/* 주차별 과제 완료율 — 가로 그라데이션 진행바 */}
            <div className="mb-8">
              <h2 className="text-base font-bold text-ink mb-3">주차별 과제 완료율</h2>
              <div className="preview-day-card border border-ink/10 rounded-2xl p-5 sm:p-6">
                <WeekRateBars weekRates={weekRates} />
              </div>
            </div>

            {/* 기상 시간 기록 — 요일 정렬 달력 */}
            <div className="mb-8">
              <h2 className="text-base font-bold text-ink mb-3">기상 시간 기록</h2>
              <div className="preview-day-card border border-ink/10 rounded-2xl p-5 sm:p-6">
                <WakeCalendar days={allDays} />
                <Legend />
              </div>
            </div>

            {/* 일별 순공시간 트렌드 */}
            <div className="mb-8">
              <h2 className="text-base font-bold text-ink mb-3">일별 순공시간 추이</h2>
              <div className="preview-day-card border border-ink/10 rounded-2xl p-4">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={studyTrend} margin={{ top: 8, right: 12, bottom: 0, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="#64748B" />
                    <YAxis tick={{ fontSize: 10 }} stroke="#64748B" />
                    <Tooltip
                      formatter={(v) => [`${Number(v).toFixed(1)}시간`, "순공"]}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Line type="monotone" dataKey="hours" stroke="#0ea5e9" strokeWidth={2.5} dot={{ r: 3, fill: "#0284c7" }} activeDot={{ r: 5, fill: "#38bdf8" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 멘토 총평 */}
            <div className="mb-2">
              <h2 className="text-base font-bold text-ink mb-3">멘토 총평</h2>
              {monthly ? (
                <div className="space-y-3">
                  <CommentField
                    label="월간 멘토 총평"
                    value={monthly.month_summary || ""}
                    onSave={(v) => patchMonthly({ month_summary: v })}
                  />
                  <CommentField
                    label="다음 달 코칭 방향"
                    value={monthly.next_month_direction || ""}
                    onSave={(v) => patchMonthly({ next_month_direction: v })}
                  />
                </div>
              ) : (
                <p className="text-sm text-ink/50">불러오는 중...</p>
              )}
            </div>

            {!hasData && (
              <p className="mt-6 text-xs rounded-xl bg-gradient-to-r from-rose/10 to-fuchsia/10 border border-rose/30 text-ink/80 px-3 py-2 no-print">
                ※ 아직 작성된 주차가 없습니다. 위쪽 1~4주차 탭에서 일별 데이터를 먼저 입력해주세요.
              </p>
            )}
          </div>{/* preview-body */}
        </div>
      </div>
    </>
  );
}

function hasDataForDay(d: DayData) {
  return d.wake_up_time != null || d.study_minutes != null || d.status !== "missed";
}

// "기상 인증 현황" 달력 셀 색상.
// status 는 submitted/incomplete/missed/paused/unset 5종이지만 STATUS_COLOR 는
// 4종만 매핑돼 있어, incomplete/unset 이면 undefined → 배경색 없음(빈칸)이 되던 버그를 방지.
// 기상 시간이 있으면(=기상 인증 제출) 상태와 무관하게 '정상 인증'(파랑)으로 표시한다.
function wakeCertColor(d: DayData): string {
  if (d.status === "paused") return STATUS_COLOR.paused; // 일시 정지
  if (d.wake_up_time) return STATUS_COLOR.submitted;     // 기상 인증 제출 → 정상 인증
  if (!hasDataForDay(d) || d.status === "unset") return STATUS_COLOR.empty; // 미입력
  return STATUS_COLOR.missed;                            // 미제출
}

// 주차별 과제 완료율 — 가로 진행바(트랙 위 그라데이션 채움 + 우측 퍼센트).
// recharts 막대차트 대신 순수 CSS 진행바로 그려 인쇄(PDF) 잘림/사라짐 없이 안정적으로 표시.
function WeekRateBars({
  weekRates,
}: {
  weekRates: { week: string; rate: number; hasData: boolean }[];
}) {
  return (
    <div className="space-y-3.5">
      {weekRates.map((w) => (
        <div key={w.week} className="flex items-center gap-3">
          <span className="w-11 shrink-0 text-sm font-semibold text-ink/70">{w.week}</span>
          <div className="relative h-3.5 flex-1 overflow-hidden rounded-full bg-slate-100">
            {w.rate > 0 && (
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#5ac8fa] via-[#4aa8f5] to-[#6366f1]"
                style={{ width: `${w.rate}%` }}
              />
            )}
          </div>
          <span className="w-11 shrink-0 text-right text-sm font-bold text-ink/70 tabular-nums">
            {w.hasData ? `${w.rate}%` : "-"}
          </span>
        </div>
      ))}
    </div>
  );
}

// 월 평균 순공시간 값: 숫자는 크게, 단위(시간/분)는 작게, 한 줄로 표시.
// (카드 폭이 좁아 "7시간 30분" 이 두 줄로 줄바꿈되던 문제 방지)
function StudyTimeValue({ minutes }: { minutes: number }) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return (
    <span className="whitespace-nowrap">
      {h}
      <span className="text-base font-bold">H </span>
      {m}
      <span className="text-base font-bold">M</span>
    </span>
  );
}

// 주간 레포트(완성 미리보기)의 PreviewStat과 동일 — 흰 카드 + 그라데이션 블러 + 하늘색 그라데이션 숫자
function PreviewStat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  tone?: "muted";
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white border border-ink/5 p-4 shadow-sm">
      <div className={`absolute inset-x-0 -top-8 h-24 bg-gradient-to-br ${
        tone === "muted" ? "from-ink/5 to-ink/0" : "from-indigo/25 via-transparent via-40% to-transparent"
      } blur-xl`} />
      <div className="relative">
        <div className={SECTION_LABEL}>{label}</div>
        <div className={`text-2xl font-extrabold mt-1 tabular-nums whitespace-nowrap ${
          tone === "muted" ? "text-ink/40" : "text-gradient"
        }`}>
          {value}
        </div>
        {sub && <div className="text-[11px] text-ink/45 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

// "2026-06-22" → 요일 인덱스(0=일 … 6=토). (y,m-1,d) 로컬 생성이라 타임존 영향 없음.
function weekdaySunFirst(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}
// "2026-06-22" → "6/22"
function mdLabel(dateStr: string): string {
  const [, m, d] = dateStr.split("-").map(Number);
  return `${m}/${d}`;
}

// 기상 시간 기록 — 실제 요일(일~토)에 맞춰 정렬된 달력. 각 칸에 날짜(M/D) + 기상 시각,
// 미제출은 "미제출", 미입력은 날짜만 옅게 표시. (색상 의미는 기존과 동일)
function WakeCalendar({ days }: { days: DayData[] }) {
  if (!days.length) return null;
  const lead = weekdaySunFirst(days[0].date); // 첫 날 앞의 빈 칸 수
  const cells: (DayData | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...days,
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (DayData | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-2 text-[11px] font-semibold text-ink/40 text-center">
        {["일", "월", "화", "수", "목", "금", "토"].map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>
      {rows.map((row, ri) => (
        <div key={ri} className="grid grid-cols-7 gap-2">
          {row.map((d, ci) =>
            d ? (
              <WakeCell key={d.date} day={d} />
            ) : (
              <div key={`e-${ri}-${ci}`} className="min-h-[58px] rounded-xl bg-slate-50 sm:min-h-[66px]" />
            ),
          )}
        </div>
      ))}
    </div>
  );
}

function WakeCell({ day }: { day: DayData }) {
  const color = wakeCertColor(day);
  const isEmpty = color === STATUS_COLOR.empty;
  const isMissed = color === STATUS_COLOR.missed;
  const time = day.wake_up_time ? day.wake_up_time.slice(0, 5) : null;
  return (
    <div
      className="min-h-[58px] rounded-xl flex flex-col items-center justify-center gap-0.5 px-1 py-2 sm:min-h-[66px]"
      style={{ backgroundColor: color }}
    >
      <div className={`text-[11px] font-semibold ${isEmpty ? "text-ink/35" : "text-white/90"}`}>
        {mdLabel(day.date)}
      </div>
      {time ? (
        <div className={`text-[13px] font-bold tabular-nums ${isEmpty ? "text-ink/45" : "text-white"}`}>
          {time}
        </div>
      ) : isMissed ? (
        <div className="text-[11px] font-bold text-white">미제출</div>
      ) : null}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex gap-4 mt-4 text-xs text-ink/60 flex-wrap">
      <LegendDot color={STATUS_COLOR.submitted} label="정상 인증" />
      <LegendDot color={STATUS_COLOR.missed} label="미제출" />
      <LegendDot color={STATUS_COLOR.paused} label="일시 정지" />
      <LegendDot color={STATUS_COLOR.empty} label="미입력" />
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
      <span>{label}</span>
    </div>
  );
}

function CommentField({
  label,
  value: initial,
  onSave,
}: {
  label: string;
  value: string;
  onSave: (v: string) => void;
}) {
  const [text, setText] = useState(initial);
  useEffect(() => setText(initial), [initial]);
  return (
    <div className="preview-day-card border border-ink/10 rounded-2xl p-5">
      <label className="text-sm font-bold text-ink">{label}</label>
      <textarea
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => text !== initial && onSave(text)}
        className="mt-2 w-full rounded-xl border border-ink/10 bg-white px-3 py-2 outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15 transition text-sm leading-relaxed print:hidden"
        placeholder="자유롭게 작성하세요. 학부모에게 전달되는 내용입니다."
      />
      <div className="hidden print:block mt-1 text-sm text-ink/80 leading-relaxed whitespace-pre-wrap">{text}</div>
    </div>
  );
}
