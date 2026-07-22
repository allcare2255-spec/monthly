"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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

  const pausedDays = allDays.filter((d) => d.status === "paused").length;

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
          {/* 상단 브랜드 헤더 배너 (주간 레포트와 동일 언어) */}
          <header className="preview-banner overflow-hidden rounded-3xl bg-gradient-to-r from-[#38bdf8] via-[#0ea5e9] to-[#0284c7] px-6 py-6 sm:px-9 sm:py-8 text-white shadow-lg shadow-[#0ea5e9]/25">
            <div className="flex flex-wrap items-start justify-between gap-4">
              {/* 좌측: 심볼 로고 + 브랜드명 + 부제목 */}
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
              {/* 우측: 기간(년/월) + 사이클 기간 + 담당 멘토 */}
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
            {/* 헤더 아래 학생명 영역 */}
            <div className="px-1 pt-7 pb-6 sm:pt-8">
              <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#0284c7]">
                코칭 {cycle}개월차 · Monthly
              </div>
              <h1 className="mt-1.5 text-3xl font-extrabold text-ink">
                {studentName} <span className="text-ink/25 font-bold">·</span> 코칭 {cycle}개월차 월간 레포트
              </h1>
              <p className="mt-2 text-sm text-ink/55">
                {highSchool ? `${highSchool} · ` : ""}{fmtDot(cycleStart)} ~ {fmtDot(cycleEnd)}
              </p>
            </div>

            {/* 통계 요약 — 파스텔 스탯 카드 */}
            <div className="grid grid-cols-2 gap-4 mb-8 sm:grid-cols-4">
              <PreviewStat label="종합 과제 완료율" value={`${stats.taskRate}%`} sub={`${stats.submitted}/${stats.total}일`} />
              <PreviewStat label="월 평균 순공시간" value={<StudyTimeValue minutes={stats.avgStudy} />} />
              <PreviewStat label="월 평균 기상" value={stats.avgWake} />
              <PreviewStat label="일시 정지" value={`${pausedDays}일`} tone="muted" />
            </div>

            {/* 28일 달력형 기상 인증 */}
            <div className="mb-8">
              <h2 className="text-base font-bold text-ink mb-3">28일 기상 인증 현황</h2>
              <div className="preview-day-card border border-ink/10 rounded-2xl p-5">
                <Calendar28 days={allDays} />
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

            {/* 주차별 과제 완료율 */}
            <div className="mb-8">
              <h2 className="text-base font-bold text-ink mb-3">주차별 과제 완료율</h2>
              <div className="preview-day-card border border-ink/10 rounded-2xl p-4">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={weekRates} margin={{ top: 8, right: 12, bottom: 0, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} stroke="#64748B" />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke="#64748B" />
                    <Tooltip formatter={(v) => [`${v}%`, "완료율"]} contentStyle={{ fontSize: 12 }} />
                    <Bar dataKey="rate" radius={[8, 8, 0, 0]}>
                      {weekRates.map((w, i) => {
                        const colors = ["#0ea5e9", "#0284c7", "#38bdf8", "#0369a1"];
                        return <Cell key={i} fill={w.hasData ? colors[i] : "#E2E8F0"} />;
                      })}
                    </Bar>
                  </BarChart>
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

// 월 평균 순공시간 값: 숫자는 크게, 단위(시간/분)는 작게, 한 줄로 표시.
// (카드 폭이 좁아 "7시간 30분" 이 두 줄로 줄바꿈되던 문제 방지)
function StudyTimeValue({ minutes }: { minutes: number }) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return (
    <span className="whitespace-nowrap">
      {h}
      <span className="text-base font-bold">시간 </span>
      {m}
      <span className="text-base font-bold">분</span>
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

function Calendar28({ days }: { days: DayData[] }) {
  const weeks: DayData[][] = [];
  for (let i = 0; i < 4; i++) weeks.push(days.slice(i * 7, (i + 1) * 7));
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-1.5 text-[10px] text-ink/50 text-center">
        {["월", "화", "수", "목", "금", "토", "일"].map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>
      {weeks.map((wk, i) => (
        <div key={i} className="grid grid-cols-7 gap-1.5">
          {wk.map((d) => {
            const color = wakeCertColor(d);
            return (
              <div
                key={d.date}
                className="aspect-square rounded-lg flex flex-col items-center justify-center text-[10px] font-semibold relative"
                style={{ backgroundColor: color }}
              >
                <div className={color === STATUS_COLOR.empty ? "text-ink/40" : "text-white"}>
                  {Number(d.date.slice(-2))}
                </div>
                {d.wake_up_time && (
                  <div className={`text-[9px] mt-0.5 ${color === STATUS_COLOR.empty ? "text-ink/50" : "text-white/90"}`}>
                    {d.wake_up_time.slice(0, 5)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
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
