"use client";

import { useEffect, useMemo, useState } from "react";
import type { DayData, DayStatus, WeeklyReport } from "@/types";
import { hmToMinutes, minutesToHm } from "@/lib/dates";

const WEEKDAY_KO = ["월", "화", "수", "목", "금", "토", "일"];

export function WeeklyReportEditor({
  studentId,
  cycle,
  week,
}: {
  studentId: string;
  cycle: number;
  week: number;
}) {
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingField, setSavingField] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports/weekly?student_id=${studentId}&cycle=${cycle}&week=${week}`)
      .then((r) => r.json())
      .then((d) => {
        setReport(d.report);
        setLoading(false);
      });
  }, [studentId, cycle, week]);

  async function patch(patchObj: Partial<WeeklyReport>, fieldKey: string) {
    if (!report) return;
    setSavingField(fieldKey);
    const res = await fetch("/api/reports/weekly", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: report.id, student_id: studentId, ...patchObj }),
    });
    const data = await res.json();
    setSavingField(null);
    if (res.ok) setReport(data.report);
  }

  function updateDay(idx: number, dayPatch: Partial<DayData>) {
    if (!report) return;
    const nextDays = report.day_data.map((d, i) =>
      i === idx ? { ...d, ...dayPatch } : d,
    );
    setReport({ ...report, day_data: nextDays });
    return nextDays;
  }

  async function commitDay(idx: number, dayPatch: Partial<DayData>) {
    const next = updateDay(idx, dayPatch);
    if (!next) return;
    await patch({ day_data: next }, `day-${idx}`);
  }

  const stats = useMemo(() => {
    if (!report) return null;
    const days = report.day_data;
    const counted = days.filter((d) => d.status !== "paused");
    const submitted = days.filter((d) => d.status === "submitted").length;
    const totalDay = counted.length;
    const studyDays = counted.filter((d) => d.study_minutes != null);
    const totalStudy = studyDays.reduce((s, d) => s + (d.study_minutes || 0), 0);
    const avgStudy = studyDays.length ? Math.round(totalStudy / studyDays.length) : 0;
    const wakeDays = counted.filter((d) => d.wake_up_time);
    const wakeMinutes = wakeDays
      .map((d) => hmToMinutes(d.wake_up_time))
      .filter((m): m is number => m != null);
    const avgWake = wakeMinutes.length
      ? Math.round(wakeMinutes.reduce((s, m) => s + m, 0) / wakeMinutes.length)
      : null;
    return {
      submitted,
      totalDay,
      taskRate: totalDay ? Math.round((submitted / totalDay) * 100) : 0,
      avgStudy,
      avgWake:
        avgWake != null
          ? `${String(Math.floor(avgWake / 60)).padStart(2, "0")}:${String(avgWake % 60).padStart(2, "0")}`
          : "-",
    };
  }, [report]);

  if (loading) {
    return <div className="rounded-xl bg-white border border-navy/10 p-8 text-center text-navy/50">불러오는 중...</div>;
  }
  if (!report) {
    return <div className="rounded-xl bg-red-50 border border-red-200 p-6 text-red-700">레포트를 불러올 수 없습니다</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end no-print">
        <button
          onClick={() => window.print()}
          className="btn-gradient rounded-xl font-semibold px-5 py-2.5"
        >
          PDF로 저장
        </button>
      </div>

      {/* 통계 요약 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="과제 달성률" value={`${stats?.taskRate || 0}%`} sub={`${stats?.submitted}/${stats?.totalDay}일`} />
        <StatCard label="평균 순공" value={minutesToHm(stats?.avgStudy)} />
        <StatCard label="평균 기상" value={stats?.avgWake || "-"} />
        <StatCard label="일시 정지" value={`${report.day_data.filter((d) => d.status === "paused").length}일`} tone="muted" />
      </div>

      {/* 일별 카드 */}
      <section className="space-y-3">
        <h2 className="text-base font-bold text-ink">일별 기록</h2>
        <div className="space-y-2">
          {report.day_data.map((day, idx) => (
            <DayCard
              key={day.date}
              day={day}
              weekday={WEEKDAY_KO[idx]}
              saving={savingField === `day-${idx}`}
              onChange={(patch) => commitDay(idx, patch)}
            />
          ))}
        </div>
      </section>

      {/* 3단계 멘토 총평 */}
      <section className="space-y-3">
        <h2 className="text-base font-bold text-ink">멘토 총평</h2>
        <CommentBlock
          label="이번 주에 잘 한 것"
          value={report.good_points || ""}
          saving={savingField === "good"}
          onSave={(v) => patch({ good_points: v }, "good")}
        />
        <CommentBlock
          label="이번 주에 아쉬운 것"
          value={report.improvement_points || ""}
          saving={savingField === "improve"}
          onSave={(v) => patch({ improvement_points: v }, "improve")}
        />
        <CommentBlock
          label="다음 주에 하면 좋을 것"
          value={report.next_week_actions || ""}
          saving={savingField === "next"}
          onSave={(v) => patch({ next_week_actions: v }, "next")}
        />
      </section>
    </div>
  );
}

function StatCard({
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
    <div className="relative overflow-hidden rounded-2xl bg-white border border-ink/5 p-4 shadow-sm">
      <div className={`absolute inset-x-0 -top-8 h-24 bg-gradient-to-br ${
        tone === "muted" ? "from-ink/5 to-ink/0" : "from-indigo/10 via-violet/8 to-fuchsia/10"
      } blur-xl`} />
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

const STATUS_STYLES: Record<DayStatus, string> = {
  submitted: "bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-800 border-emerald-200",
  missed: "bg-gradient-to-r from-rose-50 to-pink-50 text-rose border-rose/30",
  paused: "bg-slate-100 text-slate-600 border-slate-200",
};
const STATUS_LABEL: Record<DayStatus, string> = {
  submitted: "제출 완료",
  missed: "미제출",
  paused: "일시 정지",
};

function DayCard({
  day,
  weekday,
  saving,
  onChange,
}: {
  day: DayData;
  weekday: string;
  saving: boolean;
  onChange: (patch: Partial<DayData>) => void;
}) {
  const studyH = day.study_minutes != null ? Math.floor(day.study_minutes / 60) : "";
  const studyM = day.study_minutes != null ? day.study_minutes % 60 : "";

  function setStudy(h: string, m: string) {
    const hh = h === "" ? null : Number(h);
    const mm = m === "" ? null : Number(m);
    if (hh == null && mm == null) {
      onChange({ study_minutes: null, status: day.status === "submitted" ? "missed" : day.status });
      return;
    }
    const total = (hh || 0) * 60 + (mm || 0);
    // 순공 시간 입력 = 자동 제출 완료
    onChange({ study_minutes: total, status: day.status === "paused" ? "paused" : "submitted" });
  }

  return (
    <div className="bg-white border border-ink/5 rounded-2xl p-4 shadow-sm hover:shadow-md transition">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo to-violet text-white flex items-center justify-center font-bold shadow-sm shadow-indigo/30">
            {weekday}
          </div>
          <div>
            <div className="text-xs text-ink/55">{day.date}</div>
            <div className={`text-xs inline-block mt-0.5 px-2 py-0.5 rounded-full border font-medium ${STATUS_STYLES[day.status]}`}>
              {STATUS_LABEL[day.status]}
            </div>
          </div>
        </div>
        <div className="flex gap-1">
          {(["submitted", "missed", "paused"] as DayStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => onChange({ status: s })}
              className={`text-xs px-2 py-1 rounded-lg border transition ${
                day.status === s
                  ? STATUS_STYLES[s] + " font-semibold"
                  : "text-ink/55 border-ink/10 hover:bg-indigo/5"
              }`}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-ink/55 font-medium">기상 시간</label>
          <input
            type="time"
            value={day.wake_up_time || ""}
            onChange={(e) => onChange({ wake_up_time: e.target.value || null })}
            className="mt-1 w-full rounded-xl border border-ink/10 px-3 py-1.5 outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15 transition"
          />
        </div>
        <div>
          <label className="text-xs text-ink/55 font-medium">순공 시간</label>
          <div className="mt-1 flex gap-2 items-center">
            <input
              type="number"
              min="0"
              max="24"
              value={studyH}
              onChange={(e) => setStudy(e.target.value, String(studyM))}
              className="w-16 rounded-xl border border-ink/10 px-2 py-1.5 text-center outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15 transition"
              placeholder="0"
            />
            <span className="text-sm text-ink/55">시간</span>
            <input
              type="number"
              min="0"
              max="59"
              value={studyM}
              onChange={(e) => setStudy(String(studyH), e.target.value)}
              className="w-16 rounded-xl border border-ink/10 px-2 py-1.5 text-center outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15 transition"
              placeholder="0"
            />
            <span className="text-sm text-ink/55">분</span>
          </div>
        </div>
      </div>

      <div className="mt-3">
        <label className="text-xs text-ink/55 font-medium">일별 피드백 (카톡 복사·붙여넣기)</label>
        <textarea
          rows={2}
          value={day.memo || ""}
          onChange={(e) => onChange({ memo: e.target.value || null })}
          className="mt-1 w-full rounded-xl border border-ink/10 px-3 py-2 outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15 transition text-sm"
        />
      </div>
      {saving && <p className="text-[10px] text-ink/40 mt-1">저장 중...</p>}
    </div>
  );
}

function CommentBlock({
  label,
  value: initial,
  saving,
  onSave,
}: {
  label: string;
  value: string;
  saving: boolean;
  onSave: (v: string) => void;
}) {
  const [text, setText] = useState(initial);
  useEffect(() => setText(initial), [initial]);
  return (
    <div className="bg-white border border-ink/5 rounded-2xl p-4 shadow-sm">
      <label className="text-sm font-bold text-ink">{label}</label>
      <textarea
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => text !== initial && onSave(text)}
        className="mt-2 w-full rounded-xl border border-ink/10 px-3 py-2 outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15 transition text-sm leading-relaxed"
        placeholder="자유롭게 작성하세요"
      />
      {saving && <p className="text-[10px] text-ink/40 mt-1">저장 중...</p>}
    </div>
  );
}
