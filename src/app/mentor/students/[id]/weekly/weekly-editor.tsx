"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { DayData, DayPhoto, DayStatus, WeeklyReport } from "@/types";
import { hmToMinutes, minutesToHm } from "@/lib/dates";

const WEEKDAY_KO = ["월", "화", "수", "목", "금", "토", "일"];
const pad2 = (n: number) => String(n).padStart(2, "0");

export function WeeklyReportEditor({
  studentId,
  cycle,
  week,
  studentName,
  mentorName,
  cumWeek,
  weekStart,
  weekEnd,
  cycleStart,
  cycleEnd,
}: {
  studentId: string;
  cycle: number;
  week: number;
  studentName: string;
  mentorName: string;
  cumWeek: number;
  weekStart: string;
  weekEnd: string;
  cycleStart: string;
  cycleEnd: string;
}) {
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingField, setSavingField] = useState<string | null>(null);
  // [수정 4] 학생에게 보내기 → 완성 레포트 미리보기 화면
  const [preview, setPreview] = useState(false);
  const [validationModal, setValidationModal] = useState<string[] | null>(null);
  // 마지막으로 발행한 저장 요청 번호 — 오래된 응답이 최신 편집을 덮어쓰지 않도록 가드
  const writeSeq = useRef(0);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports/weekly?student_id=${studentId}&cycle=${cycle}&week=${week}`)
      .then((r) => r.json())
      .then((d) => {
        setReport(d.report);
        setLoading(false);
      });
  }, [studentId, cycle, week]);

  // [수정 4] 미리보기가 열려 있는 동안 body에 클래스 부여 → 인쇄 시 미리보기만 출력
  useEffect(() => {
    if (preview) document.body.classList.add("preview-active");
    else document.body.classList.remove("preview-active");
    return () => document.body.classList.remove("preview-active");
  }, [preview]);

  async function patch(patchObj: Partial<WeeklyReport>, fieldKey: string) {
    if (!report) return;
    const seq = ++writeSeq.current;
    setSavingField(fieldKey);
    const res = await fetch("/api/reports/weekly", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: report.id, student_id: studentId, ...patchObj }),
    });
    const data = await res.json();
    // 이 응답 이후에 더 새로운 저장이 시작됐다면, 오래된 응답으로 상태를 덮어쓰지 않는다
    if (seq !== writeSeq.current) return;
    setSavingField(null);
    if (res.ok) setReport(data.report);
  }

  function updateDayByDate(date: string, dayPatch: Partial<DayData>) {
    if (!report) return;
    const nextDays = report.day_data.map((d) =>
      d.date === date ? { ...d, ...dayPatch } : d,
    );
    setReport({ ...report, day_data: nextDays });
    return nextDays;
  }

  async function commitDayByDate(date: string, dayPatch: Partial<DayData>) {
    const next = updateDayByDate(date, dayPatch);
    if (!next) return;
    await patch({ day_data: next }, `day-${date}`);
  }

  const stats = useMemo(() => {
    if (!report) return null;
    const days = report.day_data;
    const counted = days.filter((d) => d.status !== "paused" && d.status !== "unset");
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
        {/* [수정 4] PDF로 저장 → 학생에게 보내기 (미리보기 화면 표시) */}
        <button
          onClick={() => {
            if (!report) return;
            const unselected = report.day_data
              .map((d, idx) => ({ d, label: `${WEEKDAY_KO[idx]}요일 (${d.date})` }))
              .filter(({ d }) => d.status !== "paused" && d.status === "unset")
              .map(({ label }) => label);
            if (unselected.length > 0) {
              setValidationModal(unselected);
              return;
            }
            setPreview(true);
          }}
          className="btn-gradient rounded-xl font-semibold px-5 py-2.5"
        >
          학생에게 보내기
        </button>
      </div>

      {/* [수정 1] 1. 통계 요약 — 3분할 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="과제 달성률" value={`${stats?.taskRate || 0}%`} sub={`${stats?.submitted}/${stats?.totalDay}일`} />
        <StatCard label="평균 순공 시간" value={minutesToHm(stats?.avgStudy)} />
        <StatCard label="평균 기상 시간" value={stats?.avgWake || "-"} />
      </div>

      {/* [수정 1·2] 2. 도넛 차트 2개 */}
      <DonutCharts report={report} />

      {/* [수정 1] 3. 멘토 총평 */}
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

      {/* [수정 1] 4. 일별 기록 */}
      <section className="space-y-3">
        <h2 className="text-base font-bold text-ink">일별 기록</h2>
        <div className="space-y-2">
          {report.day_data.map((day, idx) => (
            <DayCard
              key={day.date}
              day={day}
              weekday={WEEKDAY_KO[idx]}
              saving={savingField === `day-${day.date}`}
              studentId={studentId}
              cycle={cycle}
              week={week}
              onChange={(p) => commitDayByDate(day.date, p)}
            />
          ))}
        </div>
      </section>

      {/* 제출 상태 미선택 유효성 모달 */}
      {validationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 no-print">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-bold text-ink mb-2">제출 상태 미선택</h3>
            <p className="text-sm text-ink/70 mb-3">
              아직 선택하지 않은 날짜가 있어요. 모든 날짜의 제출 상태를 선택해주세요.
            </p>
            <ul className="text-sm text-rose space-y-1 mb-4">
              {validationModal.map((day) => (
                <li key={day}>· {day}</li>
              ))}
            </ul>
            <button
              onClick={() => setValidationModal(null)}
              className="w-full rounded-xl border border-ink/15 px-4 py-2 text-sm font-semibold text-ink/70 hover:bg-ink/5 transition"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* [수정 4·5·6] 완성 레포트 미리보기 (학생에게 보내기) */}
      {preview &&
        typeof document !== "undefined" &&
        createPortal(
          <ReportPreview
            studentName={studentName}
            mentorName={mentorName}
            cycle={cycle}
            cumWeek={cumWeek}
            weekStart={weekStart}
            weekEnd={weekEnd}
            cycleStart={cycleStart}
            cycleEnd={cycleEnd}
            report={report}
            stats={stats}
            onClose={() => setPreview(false)}
          />,
          document.body,
        )}
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
        tone === "muted" ? "from-ink/5 to-ink/0" : "from-indigo/25 via-transparent via-40% to-transparent"
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

// ☁️ 제출 과제 인증 — 요일별 구름 아이콘 스트릭 (제출한 날 = 하늘색 구름)
function CloudIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M2.25 15a4.5 4.5 0 0 0 4.5 4.5H18a3.75 3.75 0 0 0 1.332-7.257 3 3 0 0 0-3.758-3.848 5.25 5.25 0 0 0-10.233 2.33A4.502 4.502 0 0 0 2.25 15Z" />
    </svg>
  );
}

type CloudTone = "full" | "partial" | "none";
const CLOUD_TONE_STYLE: Record<CloudTone, { bg: string; icon: string; label: string }> = {
  full: { bg: "bg-sky-100", icon: "text-sky-500", label: "text-sky-600" },
  partial: { bg: "bg-sky-50", icon: "text-sky-300", label: "text-sky-400" },
  none: { bg: "bg-slate-100", icon: "text-slate-400", label: "text-ink/40" },
};

// 상태 → 톤 (구름/요일 배지 공통)
function submitTone(status: DayStatus): CloudTone {
  return status === "submitted" ? "full" : status === "incomplete" ? "partial" : "none";
}
// 일별 기록 요일 구름 색 — 흰 글씨가 잘 보이도록 채도 있는 톤 (미흡은 같은 하늘 계열로 살짝 진하게)
const DAY_CLOUD_COLOR: Record<CloudTone, string> = {
  full: "text-sky-500",
  partial: "text-sky-400",
  none: "text-slate-400",
};
// 요일 직사각형 배경 — 좌상단에서 햇빛이 드는 듯한 대각선 그라데이션 (밝은 흰빛 → 상태색)
const DAY_RECT_GRADIENT: Record<CloudTone, string> = {
  full: "bg-gradient-to-br from-white via-sky-50 to-sky-200",
  partial: "bg-gradient-to-br from-white via-sky-50 to-sky-100",
  none: "bg-gradient-to-br from-white via-slate-50 to-slate-200",
};

// 게이지 + 요일별 구름 스트릭 카드 (제출 과제 인증 / 기상 인증 공통)
function CertCard({
  title,
  value,
  total,
  gaugeLabel,
  gradId,
  days,
  tones,
  legend,
}: {
  title: string;
  value: number;
  total: number;
  gaugeLabel: string;
  gradId: string;
  days: DayData[];
  tones: CloudTone[];
  legend: { tone: CloudTone; label: string }[];
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white border border-ink/5 p-5 shadow-md">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo/20 via-transparent via-20% to-transparent" />
      <div className="relative">
        <div className="text-sm font-bold text-ink mb-3 text-center">{title}</div>
        {/* 게이지바 */}
        <SemiGauge value={value} total={total} label={gaugeLabel} gradId={gradId} />
        {/* 요일별 구름 스트릭 */}
        <div className="mt-6 flex items-end justify-center gap-1.5 sm:gap-2">
          {days.map((d, i) => {
            const s = CLOUD_TONE_STYLE[tones[i]];
            return (
              <div key={d.date} className="flex flex-col items-center gap-1.5">
                <div className={`grid h-9 w-9 place-items-center rounded-full ${s.bg}`}>
                  <CloudIcon className={`h-5 w-5 ${s.icon}`} />
                </div>
                <span className={`text-[11px] font-semibold ${s.label}`}>{WEEKDAY_KO[i]}</span>
              </div>
            );
          })}
        </div>
        {/* 범례 */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] text-ink/45">
          {legend.map((l) => (
            <span key={l.label} className="flex items-center gap-1">
              <CloudIcon className={`h-3 w-3 ${CLOUD_TONE_STYLE[l.tone].icon}`} />
              {l.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ⏰ 기상 인증 게이지 (반원형 게이지 차트 — 그라데이션 호 + 둥근 끝점)
function gaugePoint(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}
function gaugeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const s = gaugePoint(cx, cy, r, startAngle);
  const e = gaugePoint(cx, cy, r, endAngle);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

// 반원(180°) 게이지 — 재사용 (기상 인증 / 제출 과제 인증 공통)
function SemiGauge({
  value,
  total,
  label,
  gradId,
}: {
  value: number;
  total: number;
  label: string;
  gradId: string;
}) {
  const pct = total > 0 ? value / total : 0;
  // 왼쪽에서 위로 둥글게 떠서 오른쪽으로
  const CX = 80, CY = 84, R = 64, STROKE = 18;
  const START = 270, SWEEP = 180;
  const end = START + SWEEP * pct;
  const dot = gaugePoint(CX, CY, R, end);
  return (
    <div className="relative mx-auto h-28 w-48 shrink-0">
      <svg viewBox="0 0 160 100" className="h-full w-full">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#a5dffb" />
            <stop offset="55%" stopColor="#5fc4f2" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>
        </defs>
        {/* 배경 트랙 (반원) */}
        <path
          d={gaugeArc(CX, CY, R, START, START + SWEEP)}
          fill="none"
          stroke="#EceEF3"
          strokeWidth={STROKE}
          strokeLinecap="round"
        />
        {/* 진행 호 */}
        {pct > 0 && (
          <path
            d={gaugeArc(CX, CY, R, START, end)}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={STROKE}
            strokeLinecap="round"
          />
        )}
        {/* 끝점 — 아주 작은 흰 점 */}
        {pct > 0 && <circle cx={dot.x} cy={dot.y} r="2.5" fill="#ffffff" />}
      </svg>
      {/* 중앙 텍스트 (반원 안쪽) */}
      <div className="absolute inset-x-0 top-[40%] flex flex-col items-center">
        <div className="text-[11px] font-medium text-ink/55">{label}</div>
        <div className="text-2xl font-extrabold tabular-nums text-gradient">{value}일</div>
      </div>
    </div>
  );
}

function DonutCharts({ report }: { report: WeeklyReport }) {
  const days = report.day_data;
  // 제출 과제 인증 (제출 완료 일수) + 요일별 톤
  const submitted = days.filter((d) => d.status === "submitted").length;
  const submitTones: CloudTone[] = days.map((d) => submitTone(d.status));
  // 기상 인증 (기상 시간 입력 여부) + 요일별 톤
  const wakeOn = days.filter((d) => !!d.wake_up_time).length;
  const wakeTones: CloudTone[] = days.map((d) => (d.wake_up_time ? "full" : "none"));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <CertCard
        title="제출 과제 인증"
        value={submitted}
        total={days.length}
        gaugeLabel="제출 일수"
        gradId="submitGrad"
        days={days}
        tones={submitTones}
        legend={[
          { tone: "full", label: "제출 완료" },
          { tone: "partial", label: "과제 미흡" },
          { tone: "none", label: "미제출" },
        ]}
      />
      <CertCard
        title="기상 인증"
        value={wakeOn}
        total={days.length}
        gaugeLabel="기상 일수"
        gradId="wakeGrad"
        days={days}
        tones={wakeTones}
        legend={[
          { tone: "full", label: "기상 인증" },
          { tone: "none", label: "미인증" },
        ]}
      />
    </div>
  );
}

const STATUS_STYLES: Record<DayStatus, string> = {
  submitted: "bg-gradient-to-r from-sky-100 to-cyan-100 text-sky-800 border-sky-200",
  incomplete: "bg-pink-100 text-pink-600 border-pink-300",
  missed: "bg-gradient-to-r from-rose-50 to-pink-50 text-rose border-rose/30",
  paused: "bg-slate-100 text-slate-600 border-slate-200",
  unset: "bg-slate-100 text-slate-400 border-slate-200",
};
const STATUS_LABEL: Record<DayStatus, string> = {
  submitted: "제출 완료",
  incomplete: "과제 미흡",
  missed: "미제출",
  paused: "일시 정지",
  unset: "미선택",
};

const STATUS_RADIO: DayStatus[] = ["submitted", "incomplete", "missed"];

function DayCard({
  day,
  weekday,
  saving,
  studentId,
  cycle,
  week,
  onChange,
}: {
  day: DayData;
  weekday: string;
  saving: boolean;
  studentId: string;
  cycle: number;
  week: number;
  onChange: (patch: Partial<DayData>) => void;
}) {
  // 로컬 state: 포커스 중에는 서버 응답이 값을 덮어쓰지 않도록 분리
  const [studyHLocal, setStudyHLocal] = useState(() =>
    day.study_minutes != null ? String(Math.floor(day.study_minutes / 60)) : ""
  );
  const [studyMLocal, setStudyMLocal] = useState(() =>
    day.study_minutes != null ? String(day.study_minutes % 60) : ""
  );
  const studyFocused = useRef(false);

  const [targetStudyHLocal, setTargetStudyHLocal] = useState(() =>
    day.target_study_minutes != null ? String(Math.floor(day.target_study_minutes / 60)) : ""
  );
  const [targetStudyMLocal, setTargetStudyMLocal] = useState(() =>
    day.target_study_minutes != null ? String(day.target_study_minutes % 60) : ""
  );
  const targetStudyFocused = useRef(false);

  useEffect(() => {
    if (studyFocused.current) return;
    setStudyHLocal(day.study_minutes != null ? String(Math.floor(day.study_minutes / 60)) : "");
    setStudyMLocal(day.study_minutes != null ? String(day.study_minutes % 60) : "");
  }, [day.study_minutes]);

  useEffect(() => {
    if (targetStudyFocused.current) return;
    setTargetStudyHLocal(day.target_study_minutes != null ? String(Math.floor(day.target_study_minutes / 60)) : "");
    setTargetStudyMLocal(day.target_study_minutes != null ? String(day.target_study_minutes % 60) : "");
  }, [day.target_study_minutes]);

  function commitStudy() {
    const hh = studyHLocal === "" ? null : Number(studyHLocal);
    const mm = studyMLocal === "" ? null : Number(studyMLocal);
    if (hh == null && mm == null) {
      onChange({ study_minutes: null, status: day.status === "submitted" ? "missed" : day.status });
      return;
    }
    const total = (hh || 0) * 60 + (mm || 0);
    onChange({ study_minutes: total, status: day.status === "paused" ? "paused" : "submitted" });
  }

  function commitTargetStudy() {
    const hh = targetStudyHLocal === "" ? null : Number(targetStudyHLocal);
    const mm = targetStudyMLocal === "" ? null : Number(targetStudyMLocal);
    if (hh == null && mm == null) {
      onChange({ target_study_minutes: null });
      return;
    }
    onChange({ target_study_minutes: (hh || 0) * 60 + (mm || 0) });
  }

  return (
    <div className="bg-white border border-ink/5 rounded-2xl p-4 shadow-sm hover:shadow-md transition">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo to-violet text-white flex items-center justify-center font-bold shadow-sm shadow-indigo/30 flex-shrink-0">
          {weekday}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-ink mb-1">{day.date}</div>
          {day.status === "paused" ? (
            <span className={`text-xs inline-block px-2 py-0.5 rounded-full border font-medium ${STATUS_STYLES.paused}`}>
              {STATUS_LABEL.paused}
            </span>
          ) : (
            <div className="flex gap-1.5">
              {STATUS_RADIO.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onChange({ status: s })}
                  className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold transition
                    ${day.status === s
                      ? STATUS_STYLES[s]
                      : "bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200"
                    }`}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-ink/55 font-medium">기상 시간</label>
          <WakeTimeInput
            value={day.wake_up_time}
            onChange={onChange}
          />
        </div>
        <div>
          <label className="text-xs text-ink/55 font-medium">목표 순공 시간</label>
          <div className="mt-1 flex gap-2 items-center">
            <input
              type="number"
              min="0"
              max="24"
              value={targetStudyHLocal}
              onChange={(e) => setTargetStudyHLocal(e.target.value)}
              onFocus={() => { targetStudyFocused.current = true; }}
              onBlur={() => { targetStudyFocused.current = false; commitTargetStudy(); }}
              className="w-16 rounded-xl border border-ink/10 px-2 py-1.5 text-center outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15 transition"
              placeholder="0"
            />
            <span className="text-sm text-ink/55">시간</span>
            <input
              type="number"
              min="0"
              max="59"
              value={targetStudyMLocal}
              onChange={(e) => setTargetStudyMLocal(e.target.value)}
              onFocus={() => { targetStudyFocused.current = true; }}
              onBlur={() => { targetStudyFocused.current = false; commitTargetStudy(); }}
              className="w-16 rounded-xl border border-ink/10 px-2 py-1.5 text-center outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15 transition"
              placeholder="0"
            />
            <span className="text-sm text-ink/55">분</span>
          </div>
        </div>
        <div>
          <label className="text-xs text-ink/55 font-medium">실제 순공 시간</label>
          <div className="mt-1 flex gap-2 items-center">
            <input
              type="number"
              min="0"
              max="24"
              value={studyHLocal}
              onChange={(e) => setStudyHLocal(e.target.value)}
              onFocus={() => { studyFocused.current = true; }}
              onBlur={() => { studyFocused.current = false; commitStudy(); }}
              className="w-16 rounded-xl border border-ink/10 px-2 py-1.5 text-center outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15 transition"
              placeholder="0"
            />
            <span className="text-sm text-ink/55">시간</span>
            <input
              type="number"
              min="0"
              max="59"
              value={studyMLocal}
              onChange={(e) => setStudyMLocal(e.target.value)}
              onFocus={() => { studyFocused.current = true; }}
              onBlur={() => { studyFocused.current = false; commitStudy(); }}
              className="w-16 rounded-xl border border-ink/10 px-2 py-1.5 text-center outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15 transition"
              placeholder="0"
            />
            <span className="text-sm text-ink/55">분</span>
          </div>
        </div>
      </div>

      {/* 학생 셀프 피드백 */}
      <div className="mt-3">
        <label className="text-xs text-ink/55 font-medium">학생 셀프 피드백</label>
        <BufferedTextarea
          value={day.memo || ""}
          onCommit={(v) => onChange({ memo: v || null })}
          className="mt-1 w-full rounded-xl border border-ink/10 px-3 py-2 outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15 transition text-sm"
        />
      </div>

      {/* 멘토 피드백 요약 */}
      <div className="mt-3">
        <label className="text-xs text-ink/55 font-medium">멘토 피드백 요약</label>
        <BufferedTextarea
          value={day.mentor_memo || ""}
          onCommit={(v) => onChange({ mentor_memo: v || null })}
          className="mt-1 w-full rounded-xl border border-ink/10 px-3 py-2 outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15 transition text-sm"
        />
      </div>

      {/* Q&A */}
      <div className="mt-3">
        <div className="text-xs text-ink/55 font-medium mb-2">Q&amp;A</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-ink/55 font-medium">학생 질문</label>
            <BufferedTextarea
              value={day.student_question || ""}
              onCommit={(v) => onChange({ student_question: v || null })}
              className="mt-1 w-full rounded-xl border border-ink/10 px-3 py-2 outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15 transition text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-ink/55 font-medium">멘토 답변</label>
            <BufferedTextarea
              value={day.mentor_answer || ""}
              onCommit={(v) => onChange({ mentor_answer: v || null })}
              className="mt-1 w-full rounded-xl border border-ink/10 px-3 py-2 outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15 transition text-sm"
            />
          </div>
        </div>
      </div>

      {/* [수정 5] 공부 인증 사진 (최대 4장) */}
      <PhotoSection
        day={day}
        studentId={studentId}
        cycle={cycle}
        week={week}
        onChange={onChange}
      />

      {saving && <p className="text-[10px] text-ink/40 mt-1">저장 중...</p>}
    </div>
  );
}

const MAX_PHOTOS = 4;

// 업로드 전 이미지 다운스케일 — 휴대폰 원본(수 MB)을 줄여 저장/인쇄(PDF) 부담을 낮춘다.
// 디코드 불가(HEIC 등)나 실패 시에는 원본을 그대로 사용한다.
async function downscaleImage(file: File, maxDim = 1200, quality = 0.7): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, maxDim / longest);
    // 이미 충분히 작으면(축소 불필요 + 300KB 미만) 원본 유지
    if (scale >= 1 && file.size < 300_000) {
      bitmap.close?.();
      return file;
    }
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close?.();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob: Blob | null = await new Promise((res) =>
      canvas.toBlob(res, "image/jpeg", quality),
    );
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

function PhotoSection({
  day,
  studentId,
  cycle,
  week,
  onChange,
}: {
  day: DayData;
  studentId: string;
  cycle: number;
  week: number;
  onChange: (patch: Partial<DayData>) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const photos = day.photos || [];
  // 업로드가 진행되는 동안 클로저가 stale해지는 것을 방지: ref로 최신 사진 목록 유지
  const photosRef = useRef(photos);
  useEffect(() => { photosRef.current = day.photos || []; }, [day.photos]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (fileRef.current) fileRef.current.value = "";
    if (!files.length) return;
    setErr(null);

    const currentPhotos = photosRef.current;
    const room = MAX_PHOTOS - currentPhotos.length;
    if (room <= 0) {
      setErr(`하루 최대 ${MAX_PHOTOS}장까지 첨부할 수 있습니다.`);
      return;
    }
    const picked = files.slice(0, room);
    if (files.length > room) setErr(`최대 ${MAX_PHOTOS}장까지만 첨부되어 ${picked.length}장만 업로드합니다.`);

    setBusy(true);
    const uploaded: DayPhoto[] = [];
    for (const original of picked) {
      const file = await downscaleImage(original);
      const fd = new FormData();
      fd.append("file", file);
      fd.append("student_id", studentId);
      fd.append("cycle", String(cycle));
      fd.append("week", String(week));
      fd.append("date", day.date);
      const res = await fetch("/api/reports/weekly/photo", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) uploaded.push({ url: data.url, path: data.path });
      else setErr(data.error || "업로드 실패");
    }
    setBusy(false);
    // 업로드 완료 시점의 최신 목록(ref)에 합쳐서 저장 (stale 클로저 방지)
    if (uploaded.length) onChange({ photos: [...photosRef.current, ...uploaded] });
  }

  async function removePhoto(p: DayPhoto) {
    onChange({ photos: photos.filter((x) => x.path !== p.path) });
    await fetch("/api/reports/weekly/photo", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ student_id: studentId, path: p.path }),
    }).catch(() => {});
  }

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between">
        <label className="text-xs text-ink/55 font-medium">
          공부 인증 사진 <span className="text-ink/40">({photos.length}/{MAX_PHOTOS})</span>
        </label>
        {photos.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="no-print text-[11px] rounded-lg border border-indigo/25 bg-gradient-to-r from-indigo/8 to-fuchsia/8 hover:from-indigo/15 hover:to-fuchsia/15 text-indigo font-semibold px-2.5 py-1 transition disabled:opacity-50"
          >
            {busy ? "업로드 중..." : "+ 사진 추가"}
          </button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        onChange={onPick}
        className="hidden"
      />
      {photos.length > 0 && (
        <div className="mt-2 grid grid-cols-4 gap-2">
          {photos.map((p) => (
            <div key={p.path} className="relative group aspect-square rounded-xl overflow-hidden border border-ink/10 bg-ink/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="공부 인증" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removePhoto(p)}
                title="삭제"
                className="no-print absolute top-1 right-1 w-5 h-5 rounded-full bg-ink/70 text-white text-xs leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      {err && <p className="text-[10px] text-rose mt-1">{err}</p>}
    </div>
  );
}

// 기상 시간 — 시/분 숫자 직접 입력
function WakeTimeInput({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (patch: Partial<DayData>) => void;
}) {
  const [localH, setLocalH] = useState(() => {
    const min = hmToMinutes(value);
    return min != null ? String(Math.floor(min / 60)) : "";
  });
  const [localM, setLocalM] = useState(() => {
    const min = hmToMinutes(value);
    return min != null ? String(min % 60) : "";
  });
  const focused = useRef(false);

  useEffect(() => {
    if (focused.current) return;
    const min = hmToMinutes(value);
    setLocalH(min != null ? String(Math.floor(min / 60)) : "");
    setLocalM(min != null ? String(min % 60) : "");
  }, [value]);

  function commitWake() {
    const hv = localH === "" ? null : Number(localH);
    const mv = localM === "" ? null : Number(localM);
    if (hv == null && mv == null) {
      onChange({ wake_up_time: null });
      return;
    }
    onChange({ wake_up_time: `${pad2(hv || 0)}:${pad2(mv || 0)}` });
  }

  return (
    <div className="mt-1 flex gap-2 items-center">
      <input
        type="number"
        min="0"
        max="23"
        value={localH}
        onChange={(e) => setLocalH(e.target.value)}
        onFocus={() => { focused.current = true; }}
        onBlur={() => { focused.current = false; commitWake(); }}
        className="w-16 rounded-xl border border-ink/10 px-2 py-1.5 text-center outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15 transition"
        placeholder="7"
      />
      <span className="text-sm text-ink/55">시</span>
      <input
        type="number"
        min="0"
        max="59"
        value={localM}
        onChange={(e) => setLocalM(e.target.value)}
        onFocus={() => { focused.current = true; }}
        onBlur={() => { focused.current = false; commitWake(); }}
        className="w-16 rounded-xl border border-ink/10 px-2 py-1.5 text-center outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15 transition"
        placeholder="00"
      />
      <span className="text-sm text-ink/55">분</span>
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
      {/* [수정 4] 내용 길이에 맞게 자동 확장 */}
      <AutoTextarea
        value={text}
        onChange={setText}
        onBlur={() => text !== initial && onSave(text)}
        className="mt-2 w-full rounded-xl border border-ink/10 px-3 py-2 outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15 transition text-sm leading-relaxed"
        placeholder="자유롭게 작성하세요"
      />
      {saving && <p className="text-[10px] text-ink/40 mt-1">저장 중...</p>}
    </div>
  );
}

// [수정 4] 내용 길이에 맞게 높이 자동 확장 + 스크롤바 없음
function AutoTextarea({
  value,
  onChange,
  onFocus,
  onBlur,
  className,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  className?: string;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={2}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={onFocus}
      onBlur={onBlur}
      placeholder={placeholder}
      className={`resize-none overflow-hidden ${className || ""}`}
    />
  );
}

// 일별 텍스트 입력 — 타이핑 중에는 로컬 상태만 갱신하고, 포커스를 잃을 때만 저장.
// (글자마다 서버 PATCH + 전체 상태 교체로 인한 렉/입력 유실 방지)
function BufferedTextarea({
  value,
  onCommit,
  className,
  placeholder,
}: {
  value: string;
  onCommit: (v: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const [text, setText] = useState(value);
  const focused = useRef(false);
  // 포커스 중이 아닐 때만 서버 값으로 동기화 (입력 중 덮어쓰기 방지)
  useEffect(() => {
    if (focused.current) return;
    setText(value);
  }, [value]);
  return (
    <AutoTextarea
      value={text}
      onChange={setText}
      onFocus={() => { focused.current = true; }}
      onBlur={() => {
        focused.current = false;
        if (text !== value) onCommit(text);
      }}
      className={className}
      placeholder={placeholder}
    />
  );
}

// ─────────────────────────────────────────────────────────────
// [수정 4·5·6] 완성 레포트 미리보기 + PDF 저장
// ─────────────────────────────────────────────────────────────

type StatsShape = {
  submitted: number;
  totalDay: number;
  taskRate: number;
  avgStudy: number;
  avgWake: string;
} | null;

function wakeText(day: DayData): string | null {
  const min = hmToMinutes(day.wake_up_time);
  if (min == null) return null;
  return `${Math.floor(min / 60)}시 ${pad2(min % 60)}분`;
}

function ReportPreview({
  studentName,
  mentorName,
  cycle,
  cumWeek,
  weekStart,
  weekEnd,
  cycleStart,
  cycleEnd,
  report,
  stats,
  onClose,
}: {
  studentName: string;
  mentorName: string;
  cycle: number;
  cumWeek: number;
  weekStart: string;
  weekEnd: string;
  cycleStart: string;
  cycleEnd: string;
  report: WeeklyReport;
  stats: StatsShape;
  onClose: () => void;
}) {
  const [preparing, setPreparing] = useState(false);

  async function handleSavePdf() {
    setPreparing(true);
    try {
      // 미리보기 안의 모든 이미지 디코딩 완료까지 대기 → 인쇄 중 멈춤(렉) 방지
      const root = document.querySelector("[data-preview-root]");
      if (root) {
        const imgs = Array.from(root.querySelectorAll("img"));
        await Promise.all(
          imgs.map((img) =>
            img.complete
              ? img.decode().catch(() => {})
              : new Promise<void>((res) => {
                  img.onload = () => res();
                  img.onerror = () => res();
                }),
          ),
        );
      }
    } finally {
      setPreparing(false);
    }

    // PDF 파일명 자동 설정: "홍길동 1주차 주간 레포트" (파일명 금지문자 제거)
    const fileName = `${studentName} ${cumWeek}주차 주간 레포트`
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

  const comments = [
    { label: "이번 주에 잘 한 것", value: report.good_points },
    { label: "이번 주에 아쉬운 것", value: report.improvement_points },
    { label: "다음 주에 하면 좋을 것", value: report.next_week_actions },
  ].filter((c) => (c.value || "").trim());

  // 표시용 기간 포맷팅 (데이터 변경 아님) — "2026-06-01" → "2026.06.01"
  const fmtDot = (d: string) => (d || "").replace(/-/g, ".");
  const [periodYear, periodMonth] = (weekStart || "").split("-");
  const periodTitle = periodYear && periodMonth ? `${periodYear}년 ${Number(periodMonth)}월` : "";

  return (
    <div
      data-preview-root
      className="fixed inset-0 z-50 overflow-auto bg-white"
    >
      {/* 액션 바 (인쇄 시 숨김) */}
      <div className="preview-actions no-print sticky top-0 z-10 flex items-center justify-between gap-3 bg-white/90 backdrop-blur border-b border-ink/10 px-5 py-3">
        <button
          onClick={onClose}
          className="rounded-xl border border-ink/15 px-4 py-2 text-sm font-semibold text-ink/70 hover:bg-ink/5 transition"
        >
          ← 닫기
        </button>
        <div className="text-sm font-semibold text-ink/60">완성 레포트 미리보기</div>
        <button
          onClick={handleSavePdf}
          disabled={preparing}
          className="btn-gradient rounded-xl font-semibold px-5 py-2.5 disabled:opacity-60"
        >
          {preparing ? "준비 중..." : "PDF로 저장"}
        </button>
      </div>

      {/* 완성 문서 */}
      <div className="preview-doc mx-auto max-w-[860px] px-4 sm:px-6 py-6 sm:py-8">
        {/* 상단 브랜드 헤더 배너 */}
        <header className="overflow-hidden rounded-3xl bg-gradient-to-r from-[#38bdf8] via-[#0ea5e9] to-[#0284c7] px-6 py-6 sm:px-9 sm:py-8 text-white shadow-lg shadow-[#0ea5e9]/25">
          <div className="flex flex-wrap items-start justify-between gap-4">
            {/* 좌측: 심볼 로고 + 브랜드명 + 부제목 */}
            <div className="flex items-center gap-3.5">
              <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white ring-1 ring-white/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.jpg" alt="SKY MATE 로고" className="h-9 w-9 object-contain" />
              </div>
              <div>
                <div className="text-xl font-extrabold tracking-tight">SKY MATE</div>
                <div className="mt-0.5 text-[13px] font-medium text-white/70">주간 학습코칭 레포트</div>
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

        {/* [신규] 헤더 아래 학생명 영역 (흰 배경, 헤더와 분리) */}
        <div className="px-1 pt-7 pb-6 sm:pt-8">
          <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#0284c7]">
            코칭 {cycle}개월차 · Weekly
          </div>
          <h1 className="mt-1.5 text-3xl font-extrabold text-ink">
            {studentName} <span className="text-ink/25 font-bold">·</span> {cumWeek}주차 주간 레포트
          </h1>
          <p className="mt-2 text-sm text-ink/55">{fmtDot(weekStart)} ~ {fmtDot(weekEnd)}</p>
        </div>

        {/* [수정 1] 1. 통계 요약 — 카드별 파스텔 톤 */}
        <div className="grid grid-cols-1 gap-4 mb-7 sm:grid-cols-3">
          <PreviewStat label="과제 달성률" value={`${stats?.taskRate || 0}%`} sub={`${stats?.submitted}/${stats?.totalDay}일`} />
          <PreviewStat label="평균 순공 시간" value={minutesToHm(stats?.avgStudy)} />
          <PreviewStat label="평균 기상 시간" value={stats?.avgWake || "-"} />
        </div>

        {/* [수정 1·2] 2. 도넛 차트 2개 */}
        <div className="mb-8">
          <DonutCharts report={report} />
        </div>

        {/* [수정 1] 3. 멘토 총평 — 내용 있는 항목만 */}
        {comments.length > 0 && (
          <div className="mb-8">
            <h2 className="text-base font-bold text-ink mb-3">멘토 총평</h2>
            <div className="space-y-3">
              {comments.map((c) => (
                <div key={c.label} className="preview-day-card border border-ink/10 rounded-2xl p-5">
                  <div className="text-sm font-bold text-ink mb-1.5">{c.label}</div>
                  <div className="text-sm text-ink/80 leading-relaxed whitespace-pre-wrap">{c.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* [수정 1] 4. 일별 기록 */}
        <h2 className="text-base font-bold text-ink mb-3">일별 기록</h2>
        <div className="space-y-3">
          {report.day_data.map((day, idx) => (
            <PreviewDayCard key={day.date} day={day} weekday={WEEKDAY_KO[idx]} />
          ))}
        </div>
      </div>
    </div>
  );
}

// 멘토 편집 화면의 StatCard와 동일한 디자인 (흰 카드 + 그라데이션 블러 + 하늘색 그라데이션 숫자)
function PreviewStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white border border-ink/5 p-4 shadow-sm">
      <div className="absolute inset-x-0 -top-8 h-24 bg-gradient-to-br from-indigo/25 via-transparent via-40% to-transparent blur-xl" />
      <div className="relative">
        <div className="text-[11px] text-ink/55 uppercase tracking-[0.15em] font-semibold">{label}</div>
        <div className="text-2xl font-extrabold mt-1 tabular-nums text-gradient">{value}</div>
        {sub && <div className="text-[11px] text-ink/45 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

function PreviewDayCard({ day, weekday }: { day: DayData; weekday: string }) {
  const wake = wakeText(day);
  const targetStudy = day.target_study_minutes != null ? minutesToHm(day.target_study_minutes) : null;
  const study = day.study_minutes != null ? minutesToHm(day.study_minutes) : null;
  const memo = (day.memo || "").trim();
  const mentorMemo = (day.mentor_memo || "").trim();
  const studentQuestion = (day.student_question || "").trim();
  const mentorAnswer = (day.mentor_answer || "").trim();
  const photos = day.photos || [];

  return (
    <div className="preview-day-card border border-ink/10 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className={`relative w-10 h-10 shrink-0 rounded-xl ${DAY_RECT_GRADIENT[submitTone(day.status)]}`}>
          <CloudIcon className={`absolute inset-1 h-8 w-8 ${DAY_CLOUD_COLOR[submitTone(day.status)]}`} />
          <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold translate-y-[2px]">
            {weekday}
          </span>
        </div>
        <div>
          <div className="text-xs text-ink">{day.date}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs text-ink/55 font-medium">기상 시간</div>
          <div className="mt-1 text-sm text-ink">{wake ?? "-"}</div>
        </div>
        {targetStudy && (
          <div>
            <div className="text-xs text-ink/55 font-medium">목표 순공 시간</div>
            <div className="mt-1 text-sm text-ink">{targetStudy}</div>
          </div>
        )}
        {study && (
          <div>
            <div className="text-xs text-ink/55 font-medium">실제 순공 시간</div>
            <div className="mt-1 text-sm text-ink">{study}</div>
          </div>
        )}
      </div>

      {memo && (
        <div className="mt-3">
          <div className="text-xs text-ink/55 font-medium">학생 셀프 피드백</div>
          <div className="mt-1 text-sm text-ink/80 leading-relaxed whitespace-pre-wrap">{memo}</div>
        </div>
      )}

      {mentorMemo && (
        <div className="mt-3">
          <div className="text-xs text-ink/55 font-medium">멘토 피드백 요약</div>
          <div className="mt-1 text-sm text-ink/80 leading-relaxed whitespace-pre-wrap">{mentorMemo}</div>
        </div>
      )}

      {(studentQuestion || mentorAnswer) && (
        <div className="mt-3">
          <div className="text-xs text-ink/55 font-medium mb-1.5">Q&amp;A</div>
          <div className="grid grid-cols-2 gap-3">
            {studentQuestion && (
              <div>
                <div className="text-xs text-ink/55 font-medium">학생 질문</div>
                <div className="mt-1 text-sm text-ink/80 leading-relaxed whitespace-pre-wrap">{studentQuestion}</div>
              </div>
            )}
            {mentorAnswer && (
              <div>
                <div className="text-xs text-ink/55 font-medium">멘토 답변</div>
                <div className="mt-1 text-sm text-ink/80 leading-relaxed whitespace-pre-wrap">{mentorAnswer}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {photos.length > 0 && (
        <div className="mt-3">
          <div className="text-xs text-ink/55 font-medium">공부 인증 사진</div>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {photos.map((p) => (
              <div key={p.path} className="aspect-square rounded-xl overflow-hidden border border-ink/10 bg-ink/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="공부 인증" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
