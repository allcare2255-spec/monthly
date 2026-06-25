"use client";

import { useEffect, useMemo, useState } from "react";
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
import { addDays, hmToMinutes, minutesToHm } from "@/lib/dates";

const STATUS_COLOR: Record<string, string> = {
  submitted: "#10B981",   // emerald
  missed: "#EF4444",      // red
  paused: "#94A3B8",      // slate
  empty: "#E5E7EB",       // gray-200
};

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

  return (
    <>
      {/* 인쇄 버튼 */}
      <div className="no-print flex justify-end">
        <button
          onClick={() => window.print()}
          className="btn-gradient rounded-xl font-semibold px-5 py-2.5"
        >
          PDF로 저장
        </button>
      </div>

      <div className="print-target relative overflow-hidden bg-white border border-ink/5 rounded-3xl p-8 space-y-8 shadow-sm">
        {/* 인쇄 외 장식 */}
        <div className="no-print absolute -top-24 -right-24 w-72 h-72 rounded-full bg-gradient-to-br from-indigo/15 via-violet/10 to-fuchsia/15 blur-3xl pointer-events-none" />
        <div className="no-print absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-gradient-to-br from-fuchsia/10 via-rose/8 to-sunset/12 blur-3xl pointer-events-none" />

        {/* 헤더 */}
        <header className="relative border-b border-ink/10 pb-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.25em] text-indigo font-semibold">
                SKY MATE Premium Coaching
              </div>
              <h1 className="text-3xl font-extrabold text-gradient mt-2">{studentName} 학생 · 코칭 {cycle}개월차</h1>
              <p className="text-sm text-ink/55 mt-2">
                {highSchool || ""} · 기간 {cycleStart} ~ {cycleEnd}
                {mentorName && <> · 담당 {mentorName}</>}
              </p>
            </div>
            <div className="hidden print:block text-right text-[10px] tracking-[0.2em] uppercase text-ink/50">
              Monthly Report
            </div>
          </div>
        </header>

        {/* 통계 요약 */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <BigStat label="종합 과제 완료율" value={`${stats.taskRate}%`} sub={`${stats.submitted}/${stats.total}일`} />
          <BigStat label="월 평균 순공시간" value={minutesToHm(stats.avgStudy)} />
          <BigStat label="월 평균 기상" value={stats.avgWake} />
          <BigStat
            label="일시 정지"
            value={`${allDays.filter((d) => d.status === "paused").length}일`}
            tone="muted"
          />
        </section>

        {/* 28일 달력형 기상 인증 */}
        <section>
          <h2 className="text-base font-bold text-ink mb-3">28일 기상 인증 현황</h2>
          <Calendar28 days={allDays} />
          <Legend />
        </section>

        {/* 일별 순공시간 트렌드 */}
        <section>
          <h2 className="text-base font-bold text-ink mb-3">일별 순공시간 추이</h2>
          <div className="rounded-2xl border border-ink/5 bg-gradient-to-br from-cream-light/50 to-white p-4">
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
        </section>

        {/* 주차별 과제 완료율 */}
        <section>
          <h2 className="text-base font-bold text-ink mb-3">주차별 과제 완료율</h2>
          <div className="rounded-2xl border border-ink/5 bg-gradient-to-br from-cream-light/50 to-white p-4">
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
        </section>

        {/* 멘토 총평 */}
        <section className="space-y-4">
          <h2 className="text-base font-bold text-ink">멘토 총평</h2>
          {monthly ? (
            <>
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
            </>
          ) : (
            <p className="text-sm text-ink/50">불러오는 중...</p>
          )}
        </section>

        {!hasData && (
          <p className="text-xs rounded-lg bg-gradient-to-r from-sunset/10 to-rose/10 border border-sunset/30 text-ink/80 px-3 py-2">
            ※ 아직 작성된 주차가 없습니다. 위쪽 1~4주차 탭에서 일별 데이터를 먼저 입력해주세요.
          </p>
        )}
      </div>
    </>
  );
}

function hasDataForDay(d: DayData) {
  return d.wake_up_time != null || d.study_minutes != null || d.status !== "missed";
}

function BigStat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "muted";
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-ink/5 p-4 bg-gradient-to-br from-white to-cream-light/30">
      <div className={`absolute inset-x-0 -top-8 h-24 ${
        tone === "muted" ? "bg-ink/5" : "bg-gradient-to-br from-indigo/15 via-violet/10 to-fuchsia/15"
      } blur-2xl`} />
      <div className="relative">
        <div className="text-[11px] text-ink/55 uppercase tracking-[0.15em] font-semibold">{label}</div>
        <div className={`text-2xl font-extrabold mt-1 tabular-nums ${
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
            const color = !hasDataForDay(d)
              ? STATUS_COLOR.empty
              : STATUS_COLOR[d.status];
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
    <div className="flex gap-4 mt-3 text-xs text-ink/60 flex-wrap">
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
    <div className="rounded-2xl border border-ink/5 bg-gradient-to-br from-cream-light/40 to-white p-4">
      <label className="text-sm font-bold text-ink">{label}</label>
      <textarea
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => text !== initial && onSave(text)}
        className="mt-2 w-full rounded-xl border border-ink/10 bg-white px-3 py-2 outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15 transition text-sm leading-relaxed print:hidden"
        placeholder="자유롭게 작성하세요. 학부모에게 전달되는 내용입니다."
      />
      <div className="hidden print:block mt-2 text-sm text-ink/80 leading-relaxed whitespace-pre-wrap">{text}</div>
    </div>
  );
}
