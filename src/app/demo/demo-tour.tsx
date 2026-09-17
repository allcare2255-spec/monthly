"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { DayData, WeeklyPlanData, WeekdayKey } from "@/types";
import { addDays, hmToMinutes, minutesToHm } from "@/lib/dates";
import {
  DonutCharts,
  PreviewDayCard,
  PreviewStat as WeeklyStat,
  WeeklyPlanView,
} from "../mentor/students/[id]/weekly/weekly-editor";
import {
  CARD_BG,
  CARD_BG_INDIGO,
  CommentField,
  PreviewStat as MonthlyStat,
  SectionTitle,
  StudyTrendChart,
  WakeCalendar,
  WakeLegend,
  WeekRateBars,
  studyCategory,
} from "../mentor/students/[id]/monthly/monthly-view";
import {
  CONSULT_URL,
  DEMO_CHAT,
  DEMO_FEATURED_WEEK,
  DEMO_MONTHLY,
  DEMO_PLAN,
  DEMO_STUDENT,
  DEMO_WEEKS,
  DEMO_ZOOM,
  KAKAO_CAPTURES,
  TEAM,
  TESTIMONIALS,
  ZOOM_CAPTURES,
} from "./demo-data";
import {
  InViewClass,
  MotionStyles,
  Reveal,
  hmFromProgress,
  useInView,
  useProgress,
  useStepper,
} from "./demo-motion";
import {
  CaptureGallery,
  FlowNote,
  Frame,
  KakaoRoom,
  Points,
  ReplayButton,
  StepHeader,
  ZoomMock,
} from "./demo-ui";
import {
  CompareStep,
  CurriculumCard,
  MatchStep,
  PreStep,
  QnaStep,
  ResultsStep,
  TeamStep,
  TestStep,
} from "./demo-steps-more";

const WEEKDAY_KO = ["월", "화", "수", "목", "금", "토", "일"];
const WEEKDAY_KEYS: WeekdayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const fmtDot = (d: string) => d.replace(/-/g, ".");

type Step = { key: string; label: string; render: (n: number) => ReactNode };

export function DemoTour() {
  const [step, setStep] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // 대표님 피드백 순서: 매칭 → 사전 질문지·첫 컨설팅 → 계획 → 매일 관리 → 질의응답 → 테스트지 → …
  const steps: Step[] = useMemo(() => {
    const list: (Step | false)[] = [
      { key: "match", label: "멘토 매칭", render: (n) => <MatchStep n={n} /> },
      { key: "pre", label: "사전 질문지 · 첫 컨설팅", render: (n) => <PreStep n={n} /> },
      { key: "plan", label: "커리큘럼 · 계획표", render: (n) => <PlanStep n={n} /> },
      { key: "kakao", label: "매일 카톡 관리", render: (n) => <KakaoStep n={n} /> },
      { key: "qna", label: "질의응답", render: (n) => <QnaStep n={n} /> },
      { key: "test", label: "맞춤 테스트지", render: (n) => <TestStep n={n} /> },
      { key: "zoom", label: "주간 줌 컨설팅", render: (n) => <ZoomStep n={n} /> },
      { key: "weekly", label: "주간 레포트", render: (n) => <WeeklyStep n={n} /> },
      { key: "monthly", label: "월간 레포트", render: (n) => <MonthlyStep n={n} /> },
      TEAM.length > 0 && { key: "team", label: "3인 관리", render: (n) => <TeamStep n={n} /> },
      { key: "compare", label: "비교", render: (n) => <CompareStep n={n} /> },
      { key: "results", label: "성적 향상 · 후기", render: (n) => <ResultsStep n={n} /> },
      TESTIMONIALS.length > 0 && { key: "reviews", label: "후기", render: (n) => <ReviewStep n={n} /> },
    ];
    return list.filter((s): s is Step => Boolean(s));
  }, []);

  const isLast = step === steps.length - 1;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    chipRefs.current[step]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [step]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(id);
  }, [toast]);

  function openConsult() {
    if (CONSULT_URL) window.open(CONSULT_URL, "_blank", "noopener,noreferrer");
    else setToast("상담 신청 링크는 곧 연결될 예정이에요");
  }

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-ink">
      <MotionStyles />

      {/* 상단 바 */}
      <header className="sticky top-0 z-30 border-b border-ink/[0.06] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[760px] items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.jpg" alt="" className="h-7 w-7 rounded-lg object-contain" />
            <span className="text-[15px] font-extrabold tracking-tight">SKY MATE</span>
            <span className="rounded-md bg-sky-50 px-1.5 py-0.5 text-[11px] font-bold text-sky-600">고등 코칭 체험</span>
          </div>
          <button
            onClick={openConsult}
            className="rounded-full bg-ink px-3.5 py-1.5 text-[13px] font-semibold text-white transition hover:bg-ink/85 active:scale-95"
          >
            상담하기
          </button>
        </div>

        {/* 진행 단계 */}
        <div className="mx-auto max-w-[760px] px-4 pb-3">
          <div className="mb-2.5 flex gap-1">
            {steps.map((s, i) => (
              <div key={s.key} className="h-1 flex-1 overflow-hidden rounded-full bg-ink/10">
                <div
                  className="h-full rounded-full bg-sky-500 transition-[width] duration-500 ease-out"
                  style={{ width: i <= step ? "100%" : "0%" }}
                />
              </div>
            ))}
          </div>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {steps.map((s, i) => (
              <button
                key={s.key}
                ref={(el) => {
                  chipRefs.current[i] = el;
                }}
                onClick={() => setStep(i)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full py-1.5 pl-1.5 pr-3 text-[13px] font-semibold transition-all duration-300 ${
                  i === step
                    ? "bg-sky-600 text-white shadow-md shadow-sky-600/25"
                    : i < step
                      ? "bg-sky-50 text-sky-700"
                      : "bg-ink/[0.04] text-ink/45"
                }`}
              >
                <span
                  className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold transition-colors ${
                    i === step ? "bg-white text-sky-600" : i < step ? "bg-sky-500 text-white" : "bg-white text-ink/40"
                  }`}
                >
                  {i < step ? "✓" : i + 1}
                </span>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[760px] px-4 pb-32 pt-6">
        <div key={steps[step].key} className="animate-[demoFade_.45s_ease]">
          {steps[step].render(step + 1)}
        </div>
        <p className="mt-10 text-center text-[11px] leading-relaxed text-ink/40">
          ※ 코칭 과정 화면은 실제 코칭 기록을 바탕으로 재구성한 예시예요(학생·멘토 이름은 가상). 성적 향상 사례와 학부모님 반응은 실제 기록이며 이름만 가렸어요.
        </p>
      </main>

      {/* 하단 이동 */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-ink/[0.06] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[760px] gap-2 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {step > 0 && (
            <button
              onClick={() => setStep(step - 1)}
              aria-label="이전 단계"
              className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-ink/[0.05] text-lg text-ink/60 transition hover:bg-ink/10 active:scale-95"
            >
              ‹
            </button>
          )}
          <button
            onClick={() => (isLast ? openConsult() : setStep(step + 1))}
            className={`btn-gradient h-12 flex-1 rounded-2xl text-[15px] font-bold transition active:scale-[0.98] ${isLast ? "demo-shine" : ""}`}
          >
            {isLast ? "상담 신청하기" : `다음 · ${steps[step + 1].label}`}
          </button>
        </div>
      </nav>

      {toast && (
        <div className="fixed inset-x-0 bottom-24 z-40 flex justify-center px-4">
          <div className="animate-[demoMsgIn_.3s_ease] rounded-full bg-ink/90 px-4 py-2.5 text-[13px] font-medium text-white shadow-lg">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}


function ReportBanner({ kind, start, end }: { kind: "주간" | "월간"; start: string; end: string }) {
  // 월간은 대부분의 날짜가 속한 달(종료일 기준)로 표기 — 7/27~8/23 이면 "8월"
  const [y, m] = (kind === "월간" ? end : start).split("-");
  return (
    <header
      className="demo-shine overflow-hidden rounded-3xl px-5 py-5 text-white shadow-lg shadow-[#0ea5e9]/25 sm:px-8 sm:py-7"
      style={{
        backgroundColor: "#0ea5e9",
        backgroundImage: "linear-gradient(90deg, #38bdf8 0%, #0ea5e9 50%, #0284c7 100%)",
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white ring-1 ring-white/40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.jpg" alt="SKY MATE 로고" className="h-8 w-8 object-contain" />
          </div>
          <div>
            <div className="text-lg font-extrabold tracking-tight">SKY MATE</div>
            <div className="mt-0.5 text-[12px] font-medium text-white/75">{kind} 학습코칭 레포트</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xl font-extrabold sm:text-2xl">
            {y}년 {Number(m)}월
          </div>
          <div className="mt-1 text-[11px] leading-relaxed text-white/75">
            <div>
              기간: {fmtDot(start)} ~ {fmtDot(end)}
            </div>
            <div>담당 멘토: {DEMO_STUDENT.mentor}</div>
          </div>
        </div>
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────
// 주간 계획표 (할 일이 하나씩 체크되며 달성률이 올라감)
// ─────────────────────────────────────────────────────────────

// 원래 완료였던 할 일을 요일 순서대로 나열 → 이 순서로 하나씩 체크된다
const PLAN_DONE_ORDER = WEEKDAY_KEYS.flatMap((k) => DEMO_PLAN.days[k].tasks.filter((t) => t.done).map((t) => t.id));

function PlanStep({ n }: { n: number }) {
  const dates = Array.from({ length: 7 }, (_, i) => addDays(DEMO_FEATURED_WEEK.start_date, i));
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, 0.15);
  const [run, setRun] = useState(0);
  const checked = useStepper(inView, PLAN_DONE_ORDER.length, 120, 700 + run);

  const plan: WeeklyPlanData = useMemo(() => {
    const doneSet = new Set(PLAN_DONE_ORDER.slice(0, checked));
    const days = Object.fromEntries(
      WEEKDAY_KEYS.map((k) => [
        k,
        { ...DEMO_PLAN.days[k], tasks: DEMO_PLAN.days[k].tasks.map((t) => ({ ...t, done: doneSet.has(t.id) })) },
      ]),
    ) as WeeklyPlanData["days"];
    return { ...DEMO_PLAN, days };
  }, [checked]);

  return (
    <>
      <StepHeader
        n={n}
        title="컨설팅을 바탕으로, 커리큘럼과 주간 계획표를 함께 짜요"
        desc="컨설팅에서 정한 방향으로 4주 커리큘럼을 먼저 세우고, 이번 주에 할 분량을 학교·학원·시험 일정에 맞춰 요일별 계획표로 쪼개요. 한 주가 끝나면 무엇을 지켰고 무엇이 밀렸는지 달성률로 확인해요."
      />
      <Points
        items={[
          { icon: "🗺️", title: "4주 커리큘럼", text: "과목별로 4주 동안 나아갈 순서를 정해요" },
          { icon: "🗓️", title: "주간 계획표", text: "이번 주 분량을 하루 단위 할 일로 나눠요" },
          { icon: "📈", title: "달성률 점검", text: "밀린 계획은 이유를 찾아 다음 주에 반영해요" },
        ]}
      />
      <CurriculumCard current={DEMO_STUDENT.featuredWeek} />
      <FlowNote>이번 주({DEMO_STUDENT.featuredWeek}주차) 커리큘럼 → 요일별 계획표로</FlowNote>
      <div ref={ref}>
        <Frame label="멘토와 함께 세우는 주간 계획표 (예시)">
          <WeeklyPlanView key={run} plan={plan} dates={dates} weekLabel={DEMO_STUDENT.featuredCumWeek} />
          {checked >= PLAN_DONE_ORDER.length && <ReplayButton onClick={() => setRun((r) => r + 1)} />}
        </Frame>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// 매일 카톡 관리 (장문 피드백 → 요약 순서로 도착)
// ─────────────────────────────────────────────────────────────

function KakaoStep({ n }: { n: number }) {
  return (
    <>
      <StepHeader
        n={n}
        title="매일 밤, 멘토가 하루를 점검해요"
        desc="아침엔 기상 인증과 오늘 계획을, 밤엔 공부 인증과 회고를 코칭방에 올려요. 담당 멘토가 하나하나 읽고 그날 바로 장문 피드백과 한눈에 보는 요약을 보내요."
      />
      <Points
        items={[
          { icon: "☀️", title: "기상 인증", text: "매일 아침 일어난 시간과 오늘 계획을 공유해요" },
          { icon: "📸", title: "공부 인증 · 회고", text: "공부한 사진과 오늘 잘한 점·아쉬운 점을 올려요" },
          { icon: "💬", title: "장문 피드백 + 요약", text: "멘토가 하루를 꼼꼼히 짚고, 내일 할 일로 정리해요" },
        ]}
      />
      {KAKAO_CAPTURES.length ? (
        <CaptureGallery images={KAKAO_CAPTURES} />
      ) : (
        <KakaoRoom title={`${DEMO_STUDENT.name} 코칭방`} count={3} messages={DEMO_CHAT} height={560} />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// 주간 줌 컨설팅 (타이머 · 말하는 사람 · 실시간 자막)
// ─────────────────────────────────────────────────────────────

function ZoomStep({ n }: { n: number }) {
  return (
    <>
      <StepHeader
        n={n}
        title="매주 한 번, 줌으로 1:1 컨설팅해요"
        desc="한 주 동안의 계획표와 기록을 화면에 띄워 놓고 멘토와 얼굴을 보며 점검해요. 과목별 공부 방법을 조정하고, 학생이 막혔던 고민에 직접 답해요."
      />
      <Points
        items={[
          { icon: "🖥️", title: "계획 점검", text: "지난주 달성률과 밀린 이유를 함께 확인해요" },
          { icon: "🧭", title: "공부법 조정", text: "과목별로 다음 주에 바꿀 방법을 정해요" },
          { icon: "🙋", title: "고민 상담", text: "공부법·슬럼프·진로 고민에 바로 답해요" },
        ]}
      />
      {ZOOM_CAPTURES.length ? (
        <CaptureGallery images={ZOOM_CAPTURES} />
      ) : (
        <ZoomMock
          badge="주간 컨설팅"
          startSec={32 * 60 + 14}
          captions={DEMO_ZOOM.captions}
          screen={(inView) => <ZoomPlanScreen inView={inView} />}
        />
      )}

      <div className="mt-6">
        <Frame>
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-[17px] font-extrabold">컨설팅 기록</h2>
            <span className="text-[12px] text-ink/45">{DEMO_ZOOM.date}</span>
          </div>
          <p className="mt-1 text-[13px] text-ink/50">컨설팅 내용은 기록으로 남겨 주간 레포트에 함께 담아요.</p>

          <div className="mt-5 text-[13px] font-bold text-sky-700">1. 계획 점검</div>
          <div className="mt-2 space-y-2">
            {DEMO_ZOOM.planCheck.map((p, i) => (
              <Reveal key={p.subject} delay={i * 120} from="left">
                <div className="rounded-2xl bg-slate-50 p-3.5">
                  <div className="text-[13px] font-bold text-ink/80">[{p.subject}]</div>
                  <div className="mt-1 text-[14px] leading-relaxed text-ink/75">{p.text}</div>
                </div>
              </Reveal>
            ))}
          </div>

          <div className="mt-6 text-[13px] font-bold text-sky-700">2. 학생 질문 &amp; 멘토 답변</div>
          <div className="mt-2 space-y-3">
            {DEMO_ZOOM.qna.map((x, i) => (
              <Reveal key={x.q} delay={i * 120}>
                <div className="rounded-2xl border border-ink/[0.07] p-3.5">
                  <div className="flex gap-2 text-[14px] font-bold text-ink/85">
                    <span className="text-sky-600">Q.</span>
                    {x.q}
                  </div>
                  <div className="mt-2 flex gap-2 text-[14px] leading-relaxed text-ink/70">
                    <span className="font-bold text-fuchsia">A.</span>
                    <span>{x.a}</span>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </Frame>
      </div>
    </>
  );
}

const ZOOM_PLAN_ROWS = [
  { d: "월", t: "영단어 복습 · 미적분 1강 · 문학 2지문", ok: true },
  { d: "화", t: "영단어 · 극한의 성질 2강 · 문학", ok: true },
  { d: "수", t: "문학 표시 연습 · 미적분 2강 문제", ok: false },
  { d: "목", t: "대화 중심 읽기 · 헷갈린 문제 다시", ok: true },
  { d: "금", t: "영어 모의고사 실전 · 빈칸 오답", ok: false },
];

function ZoomPlanScreen({ inView }: { inView: boolean }) {
  const rows = useStepper(inView, ZOOM_PLAN_ROWS.length, 380, 500);
  const rate = useProgress(rows >= ZOOM_PLAN_ROWS.length, 900);
  return (
    <>
      <div className="flex items-center justify-between">
        <div className="text-[13px] font-extrabold">{DEMO_STUDENT.featuredCumWeek}주차 계획 점검</div>
        <div className="text-[11px] font-bold tabular-nums text-sky-600">달성률 {Math.round(89 * rate)}%</div>
      </div>
      <div className="mt-2 space-y-1.5">
        {ZOOM_PLAN_ROWS.map((r, i) => {
          const on = i < rows;
          return (
            <div
              key={r.d}
              className="flex items-center gap-2 rounded-md bg-slate-50 px-2 py-1.5 text-[11.5px]"
              style={{
                opacity: on ? 1 : 0,
                transform: on ? "none" : "translateX(-10px)",
                transition: "opacity .45s ease, transform .45s cubic-bezier(.2,.8,.2,1)",
              }}
            >
              <span className="w-4 font-bold text-ink/50">{r.d}</span>
              <span className="flex-1 truncate text-ink/75">{r.t}</span>
              <span
                className={`text-[10.5px] font-bold ${r.ok ? "text-sky-600" : "text-rose"}`}
                style={{
                  display: "inline-block",
                  transform: on ? "scale(1)" : "scale(0)",
                  transition: "transform .35s cubic-bezier(.3,1.6,.5,1) .25s",
                }}
              >
                {r.ok ? "완료" : "일부 밀림"}
              </span>
            </div>
          );
        })}
      </div>
      <div
        className="mt-2.5 rounded-md border-l-[3px] border-fuchsia bg-pink-50 px-2 py-1.5 text-[11.5px] text-ink/75"
        style={{ opacity: rate >= 1 ? 1 : 0, transition: "opacity .6s ease" }}
      >
        다음 주: 인강 1강 → 관련 문제 → 틀린 문제 확인을 한 세트로!
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// 주간 레포트 (숫자 카운트업 · 요일별 인증이 하나씩 켜짐)
// ─────────────────────────────────────────────────────────────

function WeeklyStep({ n }: { n: number }) {
  const [showAll, setShowAll] = useState(false);
  const report = DEMO_FEATURED_WEEK;
  const stats = useMemo(() => {
    const days = report.day_data;
    const counted = days.filter((d) => d.status !== "paused" && d.status !== "unset");
    const submitted = days.filter((d) => d.status === "submitted").length;
    const study = counted.filter((d) => d.study_minutes != null);
    const avgStudy = study.length ? Math.round(study.reduce((s, d) => s + (d.study_minutes || 0), 0) / study.length) : 0;
    return {
      submitted,
      totalDay: counted.length,
      taskRate: counted.length ? Math.round((submitted / counted.length) * 100) : 0,
      avgStudy,
      avgWake: avgWakeText(counted),
    };
  }, [report]);

  const statRef = useRef<HTMLDivElement>(null);
  const statIn = useInView(statRef, 0.4);
  const p = useProgress(statIn, 1500, 200);

  const donutRef = useRef<HTMLDivElement>(null);
  const donutIn = useInView(donutRef, 0.35);
  const lit = useStepper(donutIn, 7, 280, 300);
  const donutReport = useMemo(
    () => ({
      ...report,
      day_data: report.day_data.map((d, i) =>
        i < lit ? d : { ...d, status: "unset" as const, wake_up_time: null },
      ),
    }),
    [report, lit],
  );

  const comments = [
    { label: "이번 주에 잘 한 것", value: report.good_points, icon: "👍" },
    { label: "이번 주에 아쉬운 것", value: report.improvement_points, icon: "💡" },
    { label: "다음 주에 하면 좋을 것", value: report.next_week_actions, icon: "📌" },
  ];
  const days = showAll ? report.day_data : report.day_data.slice(0, 2);

  return (
    <>
      <StepHeader
        n={n}
        title="매주, 한 주를 레포트로 정리해요"
        desc="7일 동안의 기상·순공 시간·과제 제출 기록이 자동으로 모이고, 멘토가 이번 주 잘한 점·아쉬운 점·다음 주 할 일을 직접 써요. PDF로 받아 언제든 다시 볼 수 있어요."
      />
      <Frame label="매주 받아보는 주간 레포트 (예시)">
        <ReportBanner kind="주간" start={report.start_date} end={report.end_date} />
        <Reveal delay={150}>
          <div className="px-1 pb-5 pt-6">
            <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#0284c7]">
              코칭 {DEMO_STUDENT.cycle}개월차 · Weekly
            </div>
            <h2 className="mt-1.5 text-2xl font-extrabold sm:text-3xl">
              {DEMO_STUDENT.name} <span className="font-bold text-ink/25">·</span> {DEMO_STUDENT.featuredCumWeek}주차 주간 레포트
            </h2>
            <p className="mt-1.5 text-sm text-ink/55">
              {fmtDot(report.start_date)} ~ {fmtDot(report.end_date)}
            </p>
          </div>
        </Reveal>

        <div ref={statRef} className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Reveal delay={0} from="scale">
            <WeeklyStat label="평균 기상 시간" value={hmFromProgress(stats.avgWake, p)} />
          </Reveal>
          <Reveal delay={100} from="scale">
            <WeeklyStat label="평균 순공 시간" value={minutesToHm(Math.round(stats.avgStudy * p))} />
          </Reveal>
          <Reveal delay={200} from="scale">
            <WeeklyStat
              label="과제 달성률"
              value={`${Math.round(stats.taskRate * p)}%`}
              sub={`${Math.round(stats.submitted * p)}/${stats.totalDay}일`}
            />
          </Reveal>
        </div>

        <div ref={donutRef} className="mb-7">
          <DonutCharts report={donutReport} />
        </div>

        <h3 className="mb-3 text-base font-bold">멘토 총평</h3>
        <div className="mb-7 space-y-3">
          {comments.map((c, i) => (
            <Reveal key={c.label} delay={i * 120}>
              <div className="rounded-2xl border border-ink/10 p-4 sm:p-5">
                <div className="mb-1.5 text-sm font-bold">
                  <span className="mr-1">{c.icon}</span>
                  {c.label}
                </div>
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-ink/80">{c.value}</div>
              </div>
            </Reveal>
          ))}
        </div>

        <h3 className="mb-3 text-base font-bold">일별 기록</h3>
        <div className="space-y-3">
          {days.map((day, i) => (
            <Reveal key={day.date} delay={i >= 2 ? (i - 2) * 90 : i * 120}>
              <PreviewDayCard day={day} weekday={WEEKDAY_KO[i]} />
            </Reveal>
          ))}
        </div>
        {!showAll && (
          <button
            onClick={() => setShowAll(true)}
            className="mt-3 w-full rounded-2xl border border-sky-200 bg-sky-50 py-3 text-[14px] font-semibold text-sky-700 transition hover:bg-sky-100 active:scale-[0.99]"
          >
            나머지 5일 기록 더 보기
          </button>
        )}
      </Frame>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// 월간 레포트 (막대 채움 · 기상 달력 팝 · 그래프 그리기)
// ─────────────────────────────────────────────────────────────

function MonthlyStep({ n }: { n: number }) {
  const allDays: DayData[] = useMemo(() => DEMO_WEEKS.flatMap((w) => w.day_data), []);
  const stats = useMemo(() => {
    const submitted = allDays.filter((d) => d.status === "submitted").length;
    const total = allDays.filter((d) => d.status !== "paused").length;
    const study = allDays.map((d) => d.study_minutes || 0).filter((m) => m > 0);
    const avgStudy = study.length ? Math.round(study.reduce((s, m) => s + m, 0) / study.length) : 0;
    return { taskRate: total ? Math.round((submitted / total) * 100) : 0, avgStudy, avgWake: avgWakeText(allDays) };
  }, [allDays]);

  const statRef = useRef<HTMLDivElement>(null);
  const statIn = useInView(statRef, 0.4);
  const p = useProgress(statIn, 1500, 200);

  const barRef = useRef<HTMLDivElement>(null);
  const barIn = useInView(barRef, 0.4);
  const bp = useProgress(barIn, 1400, 150);

  const weekRates = DEMO_WEEKS.map((w) => {
    const counted = w.day_data.filter((d) => d.status !== "paused");
    const submitted = w.day_data.filter((d) => d.status === "submitted").length;
    return {
      week: `${w.week_number}주차`,
      rate: Math.round(((submitted / counted.length) * 100) * bp),
      hasData: true,
    };
  });
  const studyTrend = allDays.map((d) => ({
    day: d.date.slice(5),
    minutes: d.study_minutes ?? 0,
    category: studyCategory(d, stats.avgStudy),
  }));
  const avgStudyNow = Math.round(stats.avgStudy * p);

  return (
    <>
      <StepHeader
        n={n}
        title="매달, 한 달의 변화를 한눈에 보여드려요"
        desc="4주 동안의 기상·순공 시간·과제 완료율 추이를 그래프로 정리하고, 멘토가 과목별로 무엇이 달라졌는지와 다음 달 코칭 방향을 자세히 적어요."
      />
      <Frame label="매달 받아보는 월간 레포트 (예시)">
        <ReportBanner kind="월간" start={DEMO_STUDENT.cycleStart} end={DEMO_STUDENT.cycleEnd} />
        <Reveal delay={150}>
          <div className="px-1 pb-5 pt-6">
            <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#0284c7]">
              코칭 {DEMO_STUDENT.cycle}개월차 · Monthly
            </div>
            <h2 className="mt-1.5 text-2xl font-extrabold sm:text-3xl">
              {DEMO_STUDENT.name} <span className="font-bold text-ink/25">·</span> {DEMO_STUDENT.cycle}개월차 월간 레포트
            </h2>
            <p className="mt-1.5 text-sm text-ink/55">
              {fmtDot(DEMO_STUDENT.cycleStart)} ~ {fmtDot(DEMO_STUDENT.cycleEnd)}
            </p>
          </div>
        </Reveal>

        <div ref={statRef} className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Reveal from="scale">
            <MonthlyStat label="월 평균 기상 시간" value={hmFromProgress(stats.avgWake, p)} />
          </Reveal>
          <Reveal delay={100} from="scale">
            <MonthlyStat label="월 평균 순공 시간" value={`${Math.floor(avgStudyNow / 60)}H ${avgStudyNow % 60}M`} />
          </Reveal>
          <Reveal delay={200} from="scale">
            <MonthlyStat label="과제 완료율" value={`${Math.round(stats.taskRate * p)}%`} />
          </Reveal>
        </div>

        <Reveal>
          <div ref={barRef} className="mb-6 rounded-2xl border border-ink/[0.05] p-5" style={CARD_BG}>
            <SectionTitle>주차별 과제 완료율</SectionTitle>
            <WeekRateBars weekRates={weekRates} />
          </div>
        </Reveal>

        <Reveal>
          <InViewClass className="demo-wake mb-6 rounded-2xl border border-ink/[0.05] p-4 sm:p-5" style={CARD_BG}>
            <SectionTitle>기상 시간 기록</SectionTitle>
            <WakeCalendar days={allDays} />
            <WakeLegend />
          </InViewClass>
        </Reveal>

        <Reveal>
          <InViewClass className="demo-trend mb-6 rounded-2xl border border-ink/10 p-4 sm:p-5" style={CARD_BG_INDIGO}>
            <SectionTitle>일별 공부 시간</SectionTitle>
            <StudyTrendChart data={studyTrend} avgMin={stats.avgStudy} />
          </InViewClass>
        </Reveal>

        <div className="space-y-4">
          <Reveal>
            <CommentField label="월간 멘토 총평" icon="📝" variant="summary" value={DEMO_MONTHLY.month_summary || ""} readOnly />
          </Reveal>
          <Reveal delay={100}>
            <CommentField
              label="다음 달 코칭 방향"
              icon="🎯"
              variant="bullets"
              value={DEMO_MONTHLY.next_month_direction || ""}
              readOnly
            />
          </Reveal>
        </div>
      </Frame>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// 후기 (TESTIMONIALS 가 있을 때만)
// ─────────────────────────────────────────────────────────────

function ReviewStep({ n }: { n: number }) {
  return (
    <>
      <StepHeader n={n} title="직접 들어보세요" desc="SKY MATE 고등 코칭을 함께한 학생과 학부모님의 이야기예요." />
      <div className="space-y-3">
        {TESTIMONIALS.map((r, i) => (
          <Reveal key={i} delay={i * 120}>
            <div className="rounded-3xl border border-ink/[0.06] bg-white p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-sky-50 px-2 py-0.5 text-[12px] font-bold text-sky-700">{r.tag}</span>
                {r.change && (
                  <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[12px] font-bold text-emerald-700">{r.change}</span>
                )}
              </div>
              <p className="mt-3 text-[15px] leading-relaxed text-ink/80">“{r.quote}”</p>
              <div className="mt-2 text-[12px] text-ink/45">{r.who}</div>
            </div>
          </Reveal>
        ))}
      </div>
    </>
  );
}

function avgWakeText(days: DayData[]): string {
  const mins = days.map((d) => hmToMinutes(d.wake_up_time)).filter((m): m is number => m != null);
  if (!mins.length) return "-";
  const avg = Math.round(mins.reduce((s, m) => s + m, 0) / mins.length);
  return `${String(Math.floor(avg / 60)).padStart(2, "0")}:${String(avg % 60).padStart(2, "0")}`;
}
