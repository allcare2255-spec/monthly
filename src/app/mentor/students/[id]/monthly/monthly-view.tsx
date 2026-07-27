"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import type { DayData, MonthlyReport, WeeklyReport } from "@/types";
import { addDays, hmToMinutes } from "@/lib/dates";

// 주간 레포트(완성 미리보기)와 통일한 섹션/지표 라벨 서식
const SECTION_LABEL = "text-[12px] font-bold uppercase tracking-[0.12em] text-ink/55";

// 표시용 날짜 포맷 "2026-06-01" → "2026.06.01"
const fmtDot = (d: string) => (d || "").replace(/-/g, ".");

// 카드 배경 그라데이션 — blur 오버레이 대신 배경 자체에 얹는다.
// (blur 는 일부 인쇄 환경에서 검정 박스로 깨져 PDF 에서 숨겨왔고, 그래서 카드가 흰색으로 보였음.
//  단색 폴백 + 부드러운 linear-gradient 는 화면·PDF 모두 동일하게 안전하게 렌더된다.)
// 기상 시간 기록 타일 — 칸 색(파랑/빨강) 위에 얹는 은은한 광택 그라데이션.
// 색상별로 따로 만들지 않고 흰색→투명→살짝 어둡게 로 덮어, 어떤 배경색이든 같은 결로 보이게 한다.
const WAKE_CELL_SHEEN =
  "linear-gradient(150deg, rgba(255,255,255,0.26) 0%, rgba(255,255,255,0.06) 45%, rgba(0,0,0,0.05) 100%)";

const CARD_BG: CSSProperties = {
  backgroundColor: "#FFFFFF",
  backgroundImage: "linear-gradient(135deg, #F3FAFF 0%, #FBFDFF 40%, #FFFFFF 100%)",
};

// 일별 공부 시간 카드 — 꺾은선(#6366f1) 톤에 맞춘 인디고 계열 그라데이션.
// 위 CARD_BG 와 같은 밝기라 나란히 놓아도 어색하지 않다.
const CARD_BG_INDIGO: CSSProperties = {
  backgroundColor: "#FFFFFF",
  backgroundImage: "linear-gradient(135deg, #F4F5FE 0%, #FBFBFF 40%, #FFFFFF 100%)",
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

  // 인쇄 시 배너를 페이지 맨 위까지 풀블리드로 뽑기 위해, 이 화면이 열려 있는 동안
  // body 에 표식 클래스를 달아둔다 (Shell <main> 의 좌우/상하 여백을 print 에서 제거).
  useEffect(() => {
    document.body.classList.add("monthly-report-page");
    return () => document.body.classList.remove("monthly-report-page");
  }, []);

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

  // 일별 공부 시간 — 평균 대비 분류(평균 이상/이하/미제출)와 함께
  const studyTrend = useMemo(
    () =>
      allDays.map((d) => ({
        day: d.date.slice(5),
        minutes: d.study_minutes ?? 0,
        category: studyCategory(d, stats.avgStudy),
      })),
    [allDays, stats.avgStudy],
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
          {/* 상단 브랜드 헤더 배너 (로고 좌 · 기간 우) — 컴팩트.
              그라데이션은 인라인 명시 + 단색 폴백으로 → 모든 인쇄 환경에서 검정 깨짐 방지 */}
          <header
            className="preview-banner overflow-hidden rounded-3xl px-6 py-6 sm:px-9 sm:py-8 text-white shadow-lg shadow-[#0ea5e9]/25"
            style={{
              backgroundColor: "#0ea5e9",
              backgroundImage: "linear-gradient(90deg, #38bdf8 0%, #0ea5e9 50%, #0284c7 100%)",
            }}
          >
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
              {/* 우측: 날짜(년/월) + 사이클 기간 + 담당 멘토 */}
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
            {/* 배너 아래 제목 영역 (검정) — 코칭 N개월차 · 이름 N개월차 월간 레포트 */}
            <div className="monthly-lead px-1 pt-7 pb-6 sm:pt-8">
              <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#0284c7]">
                코칭 {cycle}개월차 · Monthly
              </div>
              <h1 className="mt-1.5 text-3xl font-extrabold text-ink">
                {studentName} <span className="text-ink/25 font-bold">·</span> {cycle}개월차 월간 레포트
              </h1>
              <p className="mt-2 text-sm text-ink/55">
                {fmtDot(cycleStart)} ~ {fmtDot(cycleEnd)}
              </p>
            </div>

            {/* ===== 1페이지: 통계 · 주차별 완료율 · 기상 시간 기록 ===== */}
            {/* 통계 요약 — 파스텔 스탯 카드 */}
            <div className="grid grid-cols-1 gap-4 mb-8 sm:grid-cols-3 print-avoid-break">
              <PreviewStat label="월 평균 기상 시간" value={stats.avgWake} />
              <PreviewStat label="월 평균 순공 시간" value={<StudyTimeValue minutes={stats.avgStudy} />} />
              <PreviewStat label="과제 완료율" value={`${stats.taskRate}%`} />
            </div>

            {/* 주차별 과제 완료율 — 가로 그라데이션 진행바 (제목은 카드 안에) */}
            <div className="mb-8 print-avoid-break">
              <div className="week-rate-card preview-day-card border border-ink/10 rounded-2xl p-5 sm:p-6" style={CARD_BG}>
                <SectionTitle>주차별 과제 완료율</SectionTitle>
                <WeekRateBars weekRates={weekRates} />
              </div>
            </div>

            {/* 기상 시간 기록 — 요일 정렬 달력 (제목은 카드 안에) */}
            <div className="mb-8 print-avoid-break">
              <div className="preview-day-card border border-ink/10 rounded-2xl p-5 sm:p-6">
                <SectionTitle>기상 시간 기록</SectionTitle>
                <WakeCalendar days={allDays} />
                <WakeLegend />
              </div>
            </div>

            {/* ===== 2페이지: 일별 공부 시간 · 멘토 총평 · 다음 달 코칭 방향 ===== */}
            {/* 일별 공부 시간 (2페이지 시작, 제목은 카드 안에) */}
            <div className="mb-8 print-page-break print-avoid-break">
              <div className="preview-day-card border border-ink/10 rounded-2xl p-4 sm:p-5" style={CARD_BG_INDIGO}>
                <SectionTitle>일별 공부 시간</SectionTitle>
                <StudyTrendChart data={studyTrend} avgMin={stats.avgStudy} />
              </div>
            </div>

            {/* 멘토 총평 · 다음 달 코칭 방향 — 각 카드가 제목을 가지므로 바깥 h2 는 두지 않는다 */}
            <div className="mb-2">
              {monthly ? (
                <div className="space-y-4">
                  <CommentField
                    label="월간 멘토 총평"
                    icon="📝"
                    variant="summary"
                    value={monthly.month_summary || ""}
                    onSave={(v) => patchMonthly({ month_summary: v })}
                  />
                  <CommentField
                    label="다음 달 코칭 방향"
                    icon="🎯"
                    variant="bullets"
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

// 기상 시각 → 타일 색상. 이른 기상일수록 진한 파랑, 늦을수록 연한 하늘로 연속 보간.
// (06:00 이전 = 가장 진함, 09:00 이후 = 가장 연함)
const WAKE_FAST = "#0284c7"; // 빠른 기상 (배너 톤의 진한 하늘색, ~06:00)
const WAKE_LATE = "#a9d4f5"; // 늦은 기상 (연한 하늘, ~09:00+)
const WAKE_MISSED = "#f47272"; // 미제출 (부드러운 빨강)
const WAKE_PAUSED = "#94A3B8"; // 일시 정지 (중립 slate)

function lerpHexColor(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

// 기상 시각(분) → 파랑 그라데이션 색상
function wakeTimeColor(min: number): string {
  const EARLY = 6 * 60; // 06:00
  const LATE = 9 * 60; // 09:00
  const t = Math.max(0, Math.min(1, (min - EARLY) / (LATE - EARLY)));
  return lerpHexColor(WAKE_FAST, WAKE_LATE, t);
}

// 주차별 과제 완료율 — 가로 진행바(트랙 위 그라데이션 채움 + 우측 퍼센트).
// recharts 막대차트 대신 순수 CSS 진행바로 그려 인쇄(PDF) 잘림/사라짐 없이 안정적으로 표시.
// 섹션 제목 — 카드 바깥이 아니라 카드 "안" 맨 위에 놓는다 (멘토 총평 카드와 동일한 배치).
function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 text-base font-bold text-ink">{children}</h2>;
}

function WeekRateBars({
  weekRates,
}: {
  weekRates: { week: string; rate: number; hasData: boolean }[];
}) {
  return (
    <div className="week-rate-bars space-y-3.5">
      {weekRates.map((w) => (
        <div key={w.week} className="flex items-center gap-3">
          <span className="w-11 shrink-0 text-sm font-semibold text-ink/70">{w.week}</span>
          <div className="relative h-3.5 flex-1 overflow-hidden rounded-full bg-slate-100">
            {w.rate > 0 && (
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  width: `${w.rate}%`,
                  backgroundColor: "#4aa8f5",
                  backgroundImage: "linear-gradient(90deg, #5ac8fa 0%, #4aa8f5 50%, #6366f1 100%)",
                }}
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

// 일별 공부 시간 — 평균 대비 분류.
type StudyCat = "above" | "below" | "missed";
const STUDY_CAT_COLOR: Record<StudyCat, string> = {
  above: "#0284c7", // 평균 이상 — 배너 톤의 진한 하늘색
  below: "#7dd3fc", // 평균 이하 — 연한 하늘색
  missed: "#f47272", // 미제출 — 부드러운 빨강
};
function studyCategory(d: DayData, avgMin: number): StudyCat {
  if (d.status === "paused") return "below";
  const s = d.study_minutes ?? 0;
  if (s <= 0) return "missed"; // 공부 시간 없음/미제출
  return s >= avgMin ? "above" : "below";
}
function hmShort(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}H ${m}M`;
}

// 순수 SVG 라인 차트 — recharts(ResponsiveContainer)가 인쇄(PDF)·초기 렌더에서
// 폭 0으로 측정돼 차트가 깨지던 문제를 방지하기 위해 고정 viewBox SVG 로 직접 그린다.
function StudyTrendChart({
  data,
  avgMin,
}: {
  data: { day: string; minutes: number; category: StudyCat }[];
  avgMin: number;
}) {
  const W = 760;
  const H = 210;
  const padL = 46;
  const padR = 16;
  const padT = 14;
  const padB = 26;
  const plotL = padL;
  const plotR = W - padR;
  const plotW = plotR - plotL;
  const plotT = padT;
  const plotB = H - padB;
  const plotH = plotB - plotT;

  const n = data.length;
  const dataMax = data.reduce((mx, d) => Math.max(mx, d.minutes), 0);
  // Y 최대값 = 데이터 최댓값(최소 60분). 최고점이 상단 눈금에 닿도록.
  const yMax = Math.max(60, dataMax);

  const xOf = (i: number) => (n <= 1 ? plotL + plotW / 2 : plotL + (i / (n - 1)) * plotW);
  const yOf = (min: number) => plotB - (min / yMax) * plotH;

  const pts = data.map((d, i) => ({ x: xOf(i), y: yOf(d.minutes), category: d.category }));
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  // 라인 아래 면적(그라데이션 채움)
  const area =
    n > 0
      ? `${line} L${pts[n - 1].x.toFixed(1)} ${plotB} L${pts[0].x.toFixed(1)} ${plotB} Z`
      : "";

  // Y 눈금 (0 ~ yMax, 4등분) — H/M 표기
  const yTicks = Array.from({ length: 5 }, (_, i) => (yMax * i) / 4);
  // X 라벨 — 과밀 방지: 최대 14개 정도만 표기
  const step = Math.max(1, Math.ceil(n / 14));
  const avgY = yOf(avgMin);
  const showAvg = avgMin > 0 && avgMin <= yMax;

  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="일별 공부 시간">
        <defs>
          <linearGradient id="studyArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* 가로 그리드 + Y 라벨(H/M) */}
        {yTicks.map((v) => {
          const y = yOf(v);
          return (
            <g key={v}>
              <line x1={plotL} y1={y} x2={plotR} y2={y} stroke="#E5E7EB" strokeWidth={1} strokeDasharray="3 3" />
              <text x={plotL - 8} y={y + 3.5} textAnchor="end" fontSize={10} fill="#94A3B8">
                {hmShort(v)}
              </text>
            </g>
          );
        })}

        {/* X 라벨 */}
        {data.map((d, i) =>
          i % step === 0 ? (
            <text key={d.day} x={xOf(i)} y={plotB + 16} textAnchor="middle" fontSize={10} fill="#64748B">
              {d.day}
            </text>
          ) : null,
        )}

        {/* 면적 + 라인 */}
        {n > 0 && <path d={area} fill="url(#studyArea)" stroke="none" />}
        {n > 0 && (
          <path d={line} fill="none" stroke="#6366f1" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        )}

        {/* 평균선 */}
        {showAvg && (
          <g>
            <line x1={plotL} y1={avgY} x2={plotR} y2={avgY} stroke="#94A3B8" strokeWidth={1.2} strokeDasharray="5 4" />
            <text x={plotR - 2} y={avgY - 4} textAnchor="end" fontSize={9.5} fill="#94A3B8">
              평균
            </text>
          </g>
        )}

        {/* 점 (분류별 색상 + 흰 테두리) */}
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3.6} fill={STUDY_CAT_COLOR[p.category]} stroke="#ffffff" strokeWidth={1.4} />
        ))}
      </svg>

      {/* 범례 */}
      <div className="mt-2 flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-[11px] text-ink/55">
        <LegendCatDot color={STUDY_CAT_COLOR.above} label="평균 이상" />
        <LegendCatDot color={STUDY_CAT_COLOR.below} label="평균 이하" />
        <LegendCatDot color={STUDY_CAT_COLOR.missed} label="미제출" />
      </div>
    </>
  );
}

function LegendCatDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
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
    <div
      className="stat-card relative overflow-hidden rounded-2xl border border-ink/5 p-4 shadow-sm"
      style={tone === "muted" ? { backgroundColor: "#FFFFFF" } : CARD_BG}
    >
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
              <div key={`e-${ri}-${ci}`} className="wake-cell-empty min-h-[58px] rounded-xl bg-slate-50 sm:min-h-[66px]" />
            ),
          )}
        </div>
      ))}
    </div>
  );
}

function WakeCell({ day }: { day: DayData }) {
  const wakeMin = hmToMinutes(day.wake_up_time);
  const paused = day.status === "paused";
  const bg = paused ? WAKE_PAUSED : wakeMin != null ? wakeTimeColor(wakeMin) : WAKE_MISSED;
  const time = day.wake_up_time ? day.wake_up_time.slice(0, 5) : null;

  return (
    <div
      className="wake-cell min-h-[68px] rounded-2xl flex flex-col items-center justify-center gap-1 px-1 py-2 sm:min-h-[82px]"
      style={{ backgroundColor: bg, backgroundImage: WAKE_CELL_SHEEN }}
    >
      <div className="text-[11px] font-semibold text-white/90">{mdLabel(day.date)}</div>
      {time ? (
        <div className="text-[13px] font-bold tabular-nums text-white">{time}</div>
      ) : paused ? (
        <div className="text-[11px] font-bold text-white">정지</div>
      ) : (
        <div className="text-[11px] font-bold text-white">미제출</div>
      )}
    </div>
  );
}

function WakeLegend() {
  return (
    <div className="wake-legend mt-3 flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-[11px] text-ink/55">
      <LegendCatDot color={WAKE_FAST} label="빠른 기상" />
      <LegendCatDot color={WAKE_LATE} label="늦은 기상" />
      <LegendCatDot color={WAKE_MISSED} label="미제출" />
    </div>
  );
}

// 멘토 총평 / 다음 달 코칭 방향 카드.
// - summary: 빈 줄로 나뉜 문단 그대로 표시
// - bullets: 줄 단위로 점(•) 목록 표시 ("-", "·" 등 머리기호는 중복이라 벗겨낸다)
const COMMENT_TONE = {
  summary: {
    bg: "#EFF1FD",
    bgImage: "linear-gradient(135deg, #EDEFFD 0%, #F4F5FE 55%, #F8F9FF 100%)",
    border: "#DDE1FA",
    title: "#4F46E5",
    dot: "#6366F1",
  },
  bullets: {
    bg: "#EAF3FE",
    bgImage: "linear-gradient(135deg, #E7F1FE 0%, #F1F7FF 55%, #F7FBFF 100%)",
    border: "#D5E6FA",
    title: "#1D6FD0",
    dot: "#3B8FE0",
  },
} as const;

function CommentField({
  label,
  icon,
  variant,
  value: initial,
  onSave,
}: {
  label: string;
  icon: string;
  variant: keyof typeof COMMENT_TONE;
  value: string;
  onSave: (v: string) => void;
}) {
  const [text, setText] = useState(initial);
  useEffect(() => setText(initial), [initial]);

  const tone = COMMENT_TONE[variant];
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const bullets = text
    .split("\n")
    .map((l) => l.trim().replace(/^[-–—•·*]\s*/, ""))
    .filter(Boolean);

  return (
    <div
      className="preview-day-card print-avoid-break rounded-2xl p-5 sm:p-6"
      style={{
        backgroundColor: tone.bg,
        backgroundImage: tone.bgImage,
        border: `1px solid ${tone.border}`,
      }}
    >
      <div className="flex items-center gap-2">
        <span className="text-[15px] leading-none">{icon}</span>
        <span className="text-sm font-bold" style={{ color: tone.title }}>
          {label}
        </span>
      </div>

      <textarea
        rows={5}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => text !== initial && onSave(text)}
        className="mt-3 w-full rounded-xl border border-ink/10 bg-white/80 px-3 py-2 outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15 transition text-sm leading-relaxed print:hidden"
        placeholder={
          variant === "bullets"
            ? "한 줄에 한 항목씩 작성하세요. 줄마다 점(•) 목록으로 표시됩니다."
            : "자유롭게 작성하세요. 빈 줄로 문단을 나눌 수 있습니다."
        }
      />

      {/* PDF/인쇄용 서식 본문 */}
      <div className="hidden print:block mt-3 text-[15px] text-ink/90 leading-[1.7]">
        {variant === "bullets" ? (
          <ul className="space-y-1.5">
            {bullets.map((b, i) => (
              <li key={i} className="flex gap-2">
                <span
                  className="mt-[9px] h-[5px] w-[5px] shrink-0 rounded-full"
                  style={{ backgroundColor: tone.dot }}
                />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="space-y-2.5">
            {paragraphs.map((p, i) => (
              <p key={i} className="whitespace-pre-wrap">
                {p}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
