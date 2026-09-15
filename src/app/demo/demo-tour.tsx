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
  TESTIMONIALS,
  ZOOM_CAPTURES,
} from "./demo-data";
import {
  InViewClass,
  MotionStyles,
  Reveal,
  hmFromProgress,
  useInView,
  usePrefersReducedMotion,
  useProgress,
  useStepper,
} from "./demo-motion";

const WEEKDAY_KO = ["월", "화", "수", "목", "금", "토", "일"];
const WEEKDAY_KEYS: WeekdayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const fmtDot = (d: string) => d.replace(/-/g, ".");

type Step = { key: string; label: string; render: () => ReactNode };

export function DemoTour() {
  const [step, setStep] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const steps: Step[] = useMemo(() => {
    const list: Step[] = [
      { key: "plan", label: "주간 계획표", render: () => <PlanStep /> },
      { key: "kakao", label: "매일 카톡 관리", render: () => <KakaoStep /> },
      { key: "zoom", label: "주간 줌 컨설팅", render: () => <ZoomStep /> },
      { key: "weekly", label: "주간 레포트", render: () => <WeeklyStep /> },
      { key: "monthly", label: "월간 레포트", render: () => <MonthlyStep /> },
    ];
    if (TESTIMONIALS.length) list.push({ key: "reviews", label: "후기", render: () => <ReviewStep /> });
    return list;
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
          {steps[step].render()}
        </div>
        <p className="mt-10 text-center text-[11px] leading-relaxed text-ink/40">
          ※ 실제 코칭 기록을 바탕으로 재구성한 예시 화면이에요. 학생·멘토 이름 등 개인정보는 모두 가상으로 바꿨어요.
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

// ─────────────────────────────────────────────────────────────
// 공통
// ─────────────────────────────────────────────────────────────

function StepHeader({ n, title, desc }: { n: number; title: string; desc: ReactNode }) {
  return (
    <div className="mb-5">
      <Reveal>
        <div className="text-[12px] font-bold tracking-[0.18em] text-sky-600">STEP {n}</div>
        <h1 className="mt-1.5 text-[24px] font-extrabold leading-snug tracking-tight sm:text-[28px]">{title}</h1>
      </Reveal>
      <Reveal delay={120}>
        <p className="mt-2 text-[15px] leading-relaxed text-ink/60">{desc}</p>
      </Reveal>
    </div>
  );
}

function Points({ items }: { items: { icon: string; title: string; text: string }[] }) {
  return (
    <div className="mb-6 grid grid-cols-1 gap-2 sm:grid-cols-3">
      {items.map((it, i) => (
        <Reveal key={it.title} delay={200 + i * 110} from="left">
          <div className="flex h-full items-start gap-3 rounded-2xl border border-ink/[0.06] bg-white p-3.5 transition hover:-translate-y-0.5 hover:shadow-md">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sky-50 text-lg">{it.icon}</span>
            <div>
              <div className="text-[14px] font-bold">{it.title}</div>
              <div className="mt-0.5 text-[12.5px] leading-snug text-ink/55">{it.text}</div>
            </div>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

function Frame({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <Reveal delay={250} from="scale">
      <div className="rounded-3xl border border-ink/[0.06] bg-white p-4 shadow-[0_8px_30px_rgba(15,40,80,0.06)] sm:p-6">
        {label && <div className="mb-3 text-[12px] font-semibold text-ink/40">{label}</div>}
        {children}
      </div>
    </Reveal>
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

function CaptureGallery({ images }: { images: string[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {images.map((src, i) => (
        <Reveal key={src} delay={i * 120}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="실제 화면 캡처" className="w-full rounded-2xl border border-ink/10" />
        </Reveal>
      ))}
    </div>
  );
}

function ReplayButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mx-auto mt-3 flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-ink/60 shadow-sm ring-1 ring-ink/10 transition hover:text-sky-700 active:scale-95"
    >
      ↻ 다시 보기
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// STEP 1 — 주간 계획표 (할 일이 하나씩 체크되며 달성률이 올라감)
// ─────────────────────────────────────────────────────────────

// 원래 완료였던 할 일을 요일 순서대로 나열 → 이 순서로 하나씩 체크된다
const PLAN_DONE_ORDER = WEEKDAY_KEYS.flatMap((k) => DEMO_PLAN.days[k].tasks.filter((t) => t.done).map((t) => t.id));

function PlanStep() {
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
        n={1}
        title="매주, 멘토가 계획을 함께 세워요"
        desc="학생의 학교·학원 일정과 시험 일정을 보고 이번 주 목표를 정한 뒤, 요일별 할 일로 쪼개요. 한 주가 끝나면 무엇을 지켰고 무엇이 밀렸는지 달성률로 확인해요."
      />
      <Points
        items={[
          { icon: "🎯", title: "주간 목표", text: "과목별로 이번 주에 끝낼 분량을 먼저 정해요" },
          { icon: "🗓️", title: "요일별 할 일", text: "학원·시험 일정에 맞춰 하루 단위로 나눠요" },
          { icon: "📈", title: "달성률 점검", text: "밀린 계획은 이유를 찾아 다음 주에 반영해요" },
        ]}
      />
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
// STEP 2 — 매일 카톡 관리 (메시지가 입력 중 → 도착 순서로 올라옴)
// ─────────────────────────────────────────────────────────────

function KakaoStep() {
  return (
    <>
      <StepHeader
        n={2}
        title="매일 밤, 멘토가 하루를 점검해요"
        desc="아침엔 기상 인증과 오늘 계획을, 밤엔 공부 인증과 회고를 카톡 관리방에 올려요. 담당 멘토가 하나하나 읽고 그날 바로 피드백을 보내요."
      />
      <Points
        items={[
          { icon: "☀️", title: "기상 인증", text: "매일 아침 일어난 시간과 오늘 계획을 공유해요" },
          { icon: "📸", title: "공부 인증 · 회고", text: "공부한 사진과 오늘 잘한 점·아쉬운 점을 올려요" },
          { icon: "💬", title: "당일 피드백", text: "멘토가 잘한 점과 내일 바로 할 일을 정리해줘요" },
        ]}
      />
      {KAKAO_CAPTURES.length ? <CaptureGallery images={KAKAO_CAPTURES} /> : <KakaoChat />}
    </>
  );
}

function KakaoChat() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inView = useInView(wrapRef, 0.35);
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(0);
  const [run, setRun] = useState(0);

  // 메시지를 하나씩 도착시킨다 (긴 메시지일수록 다음 메시지까지 조금 더 뜸을 둔다)
  useEffect(() => {
    if (!inView || reduced) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let t = 400;
    DEMO_CHAT.forEach((m, i) => {
      timers.push(setTimeout(() => setShown(i + 1), t));
      t += "kind" in m ? 350 : Math.min(1500, 650 + (m.text?.length ?? 30) * 5);
    });
    return () => timers.forEach(clearTimeout);
  }, [inView, reduced, run]);

  const visible = reduced ? DEMO_CHAT.length : shown;
  const done = visible >= DEMO_CHAT.length;

  // 새 메시지가 오면 채팅창을 맨 아래로
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [visible]);

  function replay() {
    setShown(0);
    setRun((r) => r + 1);
  }

  return (
    <Reveal delay={250} from="scale">
      <div ref={wrapRef} className="mx-auto max-w-[460px]">
        <div className="overflow-hidden rounded-[28px] border border-ink/10 shadow-[0_12px_40px_rgba(15,40,80,0.12)]">
          <div className="flex items-center justify-between bg-[#BACEE0] px-4 py-3">
            <span className="text-lg text-ink/60">‹</span>
            <div className="text-[15px] font-bold text-ink/85">
              {DEMO_STUDENT.name} 관리방 <span className="font-medium text-ink/40">2</span>
            </div>
            <span className="text-lg text-ink/50">≡</span>
          </div>
          <div
            ref={scrollRef}
            className="h-[540px] space-y-1.5 overflow-y-auto bg-[#BACEE0] px-3 pb-5 [scrollbar-width:thin]"
          >
            {DEMO_CHAT.slice(0, visible).map((m, i) => {
              if ("kind" in m) {
                return (
                  <div key={i} className="flex animate-[demoMsgIn_.35s_ease] justify-center py-2">
                    <span className="rounded-full bg-black/10 px-3 py-1 text-[11px] text-white">{m.text}</span>
                  </div>
                );
              }
              const prev = DEMO_CHAT[i - 1];
              const first = !prev || "kind" in prev || prev.from !== m.from;
              const mine = m.from === "student";
              const bubble = m.photos ? (
                <div className="grid grid-cols-2 gap-1 overflow-hidden rounded-2xl">
                  {Array.from({ length: m.photos }, (_, k) => (
                    <div
                      key={k}
                      className="grid h-28 w-28 animate-[demoPop_.45s_ease_both] place-items-center text-center text-[11px] font-semibold text-white/90"
                      style={{
                        animationDelay: `${k * 120}ms`,
                        backgroundImage:
                          k === 0 ? "linear-gradient(135deg,#94a3b8,#64748b)" : "linear-gradient(135deg,#a8b8c8,#7b8ca0)",
                      }}
                    >
                      <div>
                        <div className="text-2xl">{k === 0 ? "📘" : "📝"}</div>
                        공부 인증
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  className={`whitespace-pre-wrap rounded-2xl px-3 py-2 text-[13.5px] leading-[1.55] ${
                    mine ? "rounded-tr-md bg-[#FEE500] text-ink" : "rounded-tl-md bg-white text-ink"
                  }`}
                >
                  {m.text}
                </div>
              );
              return (
                <div
                  key={i}
                  className={`flex animate-[demoMsgIn_.4s_cubic-bezier(.2,.8,.2,1)] gap-2 ${mine ? "justify-end" : ""} ${first ? "pt-2" : ""}`}
                  style={{ transformOrigin: mine ? "bottom right" : "bottom left" }}
                >
                  {!mine && (
                    <div className="w-9 shrink-0">
                      {first && <MentorAvatar />}
                    </div>
                  )}
                  <div className={`flex max-w-[78%] flex-col ${mine ? "items-end" : "items-start"}`}>
                    {!mine && first && <div className="mb-1 text-[12px] text-ink/70">{DEMO_STUDENT.mentor} 멘토</div>}
                    <div className={`flex items-end gap-1.5 ${mine ? "flex-row-reverse" : ""}`}>
                      {bubble}
                      <span className="shrink-0 pb-0.5 text-[10px] text-ink/45">{m.time}</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {!done && visible > 0 && (
              <div className="py-3 text-center text-[11px] text-ink/40">메시지 불러오는 중…</div>
            )}
          </div>
        </div>
        {done && !reduced && <ReplayButton onClick={replay} />}
      </div>
    </Reveal>
  );
}

function MentorAvatar() {
  return (
    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[14px] bg-gradient-to-br from-sky-400 to-sky-600 text-[13px] font-bold text-white">
      {DEMO_STUDENT.mentor[0]}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// STEP 3 — 주간 줌 컨설팅 (타이머 · 말하는 사람 · 실시간 자막)
// ─────────────────────────────────────────────────────────────

function ZoomStep() {
  return (
    <>
      <StepHeader
        n={3}
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
      {ZOOM_CAPTURES.length ? <CaptureGallery images={ZOOM_CAPTURES} /> : <ZoomMock />}

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

function ZoomMock() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, 0.3);
  const reduced = usePrefersReducedMotion();

  // 회의 시간: 32:14 부터 1초씩
  const [sec, setSec] = useState(32 * 60 + 14);
  useEffect(() => {
    if (!inView || reduced) return;
    const id = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [inView, reduced]);

  // 실시간 자막: 한 글자씩 → 잠시 멈춤 → 다음 사람
  const [cap, setCap] = useState(0);
  const [chars, setChars] = useState(0);
  const line = DEMO_ZOOM.captions[cap];
  useEffect(() => {
    if (!inView || reduced) return;
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      setChars(n);
      if (n >= line.text.length) clearInterval(id);
    }, 42);
    const next = setTimeout(
      () => {
        setChars(0);
        setCap((c) => (c + 1) % DEMO_ZOOM.captions.length);
      },
      line.text.length * 42 + 1800,
    );
    return () => {
      clearInterval(id);
      clearTimeout(next);
    };
  }, [inView, reduced, cap, line.text.length]);

  const rows = useStepper(inView, ZOOM_PLAN_ROWS.length, 380, 500);
  const rate = useProgress(rows >= ZOOM_PLAN_ROWS.length, 900);
  const speaking = line.who;
  const typed = reduced ? line.text : line.text.slice(0, chars);

  return (
    <Reveal delay={250} from="scale">
      <div ref={ref} className="overflow-hidden rounded-3xl bg-[#1c1c1e] text-white shadow-[0_12px_40px_rgba(0,0,0,0.25)]">
        {/* 상단 */}
        <div className="flex items-center justify-between px-4 py-2.5 text-[12px]">
          <span className="flex items-center gap-1.5 text-white/70">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            주간 컨설팅
          </span>
          <span className="font-semibold text-white/85">SKY MATE · {DEMO_STUDENT.featuredCumWeek}주차</span>
          <span className="flex items-center gap-1.5 tabular-nums text-white/70">
            <span className="h-2 w-2 rounded-full bg-red-500" style={{ animation: "demoRec 1.4s infinite" }} />
            기록 중 {String(Math.floor(sec / 60)).padStart(2, "0")}:{String(sec % 60).padStart(2, "0")}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2 px-2 pb-2 sm:grid-cols-[1fr_180px]">
          {/* 화면 공유 */}
          <div className="relative rounded-xl bg-[#2c2c2e] p-3 sm:p-4">
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-md bg-emerald-500/90 px-2 py-0.5 text-[10.5px] font-semibold">
              {DEMO_STUDENT.mentor} 님의 화면 공유
            </div>
            <div className="rounded-lg bg-white p-3 text-ink sm:p-4">
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
            </div>

            {/* 실시간 자막 */}
            <div className="mt-2 min-h-[44px] rounded-lg bg-black/60 px-3 py-2 text-[12.5px] leading-snug">
              <span className={`mr-1.5 font-bold ${speaking === "mentor" ? "text-sky-300" : "text-pink-300"}`}>
                {speaking === "mentor" ? DEMO_STUDENT.mentor : DEMO_STUDENT.name}
              </span>
              <span className="text-white/90">{typed}</span>
              {!reduced && chars < line.text.length && (
                <span className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-0.5 bg-white/80" style={{ animation: "demoCaret 1s infinite" }} />
              )}
            </div>
          </div>

          {/* 참가자 */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
            <ZoomTile name={`${DEMO_STUDENT.mentor} 멘토`} initial={DEMO_STUDENT.mentor[0]} speaking={speaking === "mentor"} tone="mentor" />
            <ZoomTile name={DEMO_STUDENT.name} initial={DEMO_STUDENT.name.slice(1, 2)} speaking={speaking === "student"} tone="student" />
          </div>
        </div>

        {/* 하단 툴바 */}
        <div className="flex items-center justify-between gap-1 border-t border-white/5 bg-[#161618] px-3 py-2.5">
          <div className="flex gap-1 sm:gap-3">
            <ZoomBtn icon="mic" label="음소거" />
            <ZoomBtn icon="video" label="비디오" />
          </div>
          <div className="flex gap-1 sm:gap-3">
            <ZoomBtn icon="users" label="참가자" />
            <ZoomBtn icon="chat" label="채팅" />
            <ZoomBtn icon="share" label="화면 공유" active />
          </div>
          <span className="rounded-md bg-red-600 px-2.5 py-1 text-[11.5px] font-semibold">종료</span>
        </div>
      </div>
    </Reveal>
  );
}

function ZoomTile({
  name,
  initial,
  speaking,
  tone,
}: {
  name: string;
  initial: string;
  speaking: boolean;
  tone: "mentor" | "student";
}) {
  return (
    <div
      className={`relative grid aspect-[4/3] place-items-center rounded-xl bg-[#2c2c2e] ring-2 transition-all duration-300 ${
        speaking ? "ring-emerald-400" : "ring-transparent"
      }`}
    >
      <div className="relative">
        {speaking && <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/30" />}
        <div
          className={`relative grid h-12 w-12 place-items-center rounded-full text-lg font-bold transition-transform duration-300 ${
            speaking ? "scale-110" : "scale-100"
          } ${tone === "mentor" ? "bg-gradient-to-br from-sky-400 to-sky-600" : "bg-gradient-to-br from-pink-300 to-fuchsia"}`}
        >
          {initial}
        </div>
      </div>
      <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded bg-black/50 px-1.5 py-0.5 text-[10.5px]">
        {speaking && (
          <span className="flex h-2.5 items-end gap-[1.5px]">
            {[0, 1, 2].map((b) => (
              <span
                key={b}
                className="w-[2px] origin-bottom rounded-full bg-emerald-400"
                style={{ height: "100%", animation: `demoBar .7s ${b * 0.12}s infinite ease-in-out` }}
              />
            ))}
          </span>
        )}
        {name}
      </div>
    </div>
  );
}

function ZoomBtn({ icon, label, active }: { icon: "mic" | "video" | "users" | "chat" | "share"; label: string; active?: boolean }) {
  const paths: Record<typeof icon, ReactNode> = {
    mic: <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Zm-7 9a7 7 0 0 0 14 0M12 19v3" />,
    video: <path d="M3 7h12v10H3zM15 10l6-3v10l-6-3" />,
    users: <path d="M16 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 9v-1a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />,
    chat: <path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12Z" />,
    share: <path d="M4 5h16v11H4zM12 13V8m-2.5 2.5L12 8l2.5 2.5M8 20h8" />,
  };
  return (
    <div className="flex w-12 flex-col items-center gap-0.5 sm:w-14">
      <svg
        viewBox="0 0 24 24"
        className={`h-5 w-5 ${active ? "text-emerald-400" : "text-white/80"}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {paths[icon]}
      </svg>
      <span className={`text-[9.5px] ${active ? "text-emerald-400" : "text-white/60"}`}>{label}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// STEP 4 — 주간 레포트 (숫자 카운트업 · 요일별 인증이 하나씩 켜짐)
// ─────────────────────────────────────────────────────────────

function WeeklyStep() {
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
        n={4}
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
// STEP 5 — 월간 레포트 (막대 채움 · 기상 달력 팝 · 그래프 그리기)
// ─────────────────────────────────────────────────────────────

function MonthlyStep() {
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
        n={5}
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
// STEP 6 — 후기 (TESTIMONIALS 가 있을 때만)
// ─────────────────────────────────────────────────────────────

function ReviewStep() {
  return (
    <>
      <StepHeader n={6} title="직접 들어보세요" desc="SKY MATE 고등 코칭을 함께한 학생과 학부모님의 이야기예요." />
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
