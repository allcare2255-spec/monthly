"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { DayData } from "@/types";
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

const WEEKDAY_KO = ["월", "화", "수", "목", "금", "토", "일"];
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
            className="rounded-full bg-ink px-3.5 py-1.5 text-[13px] font-semibold text-white transition hover:bg-ink/85"
          >
            상담하기
          </button>
        </div>

        {/* 진행 단계 */}
        <div className="mx-auto max-w-[760px] px-4 pb-3">
          <div className="mb-2.5 flex gap-1">
            {steps.map((s, i) => (
              <div
                key={s.key}
                className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? "bg-sky-500" : "bg-ink/10"}`}
              />
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
                className={`flex shrink-0 items-center gap-1.5 rounded-full py-1.5 pl-1.5 pr-3 text-[13px] font-semibold transition ${
                  i === step
                    ? "bg-sky-600 text-white"
                    : i < step
                      ? "bg-sky-50 text-sky-700"
                      : "bg-ink/[0.04] text-ink/45"
                }`}
              >
                <span
                  className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold ${
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
        <div key={steps[step].key} className="animate-[demoFade_.35s_ease]">
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
              className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-ink/[0.05] text-lg text-ink/60 transition hover:bg-ink/10"
            >
              ‹
            </button>
          )}
          <button
            onClick={() => (isLast ? openConsult() : setStep(step + 1))}
            className="btn-gradient h-12 flex-1 rounded-2xl text-[15px] font-bold"
          >
            {isLast ? "상담 신청하기" : `다음 · ${steps[step + 1].label}`}
          </button>
        </div>
      </nav>

      {toast && (
        <div className="fixed inset-x-0 bottom-24 z-40 flex justify-center px-4">
          <div className="rounded-full bg-ink/90 px-4 py-2.5 text-[13px] font-medium text-white shadow-lg">{toast}</div>
        </div>
      )}

      <style>{`@keyframes demoFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 공통
// ─────────────────────────────────────────────────────────────

function StepHeader({ n, title, desc }: { n: number; title: string; desc: ReactNode }) {
  return (
    <div className="mb-5">
      <div className="text-[12px] font-bold tracking-[0.18em] text-sky-600">STEP {n}</div>
      <h1 className="mt-1.5 text-[24px] font-extrabold leading-snug tracking-tight sm:text-[28px]">{title}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink/60">{desc}</p>
    </div>
  );
}

function Points({ items }: { items: { icon: string; title: string; text: string }[] }) {
  return (
    <div className="mb-6 grid grid-cols-1 gap-2 sm:grid-cols-3">
      {items.map((it) => (
        <div key={it.title} className="flex items-start gap-3 rounded-2xl border border-ink/[0.06] bg-white p-3.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sky-50 text-lg">{it.icon}</span>
          <div>
            <div className="text-[14px] font-bold">{it.title}</div>
            <div className="mt-0.5 text-[12.5px] leading-snug text-ink/55">{it.text}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Frame({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className="rounded-3xl border border-ink/[0.06] bg-white p-4 shadow-[0_8px_30px_rgba(15,40,80,0.06)] sm:p-6">
      {label && <div className="mb-3 text-[12px] font-semibold text-ink/40">{label}</div>}
      {children}
    </div>
  );
}

function ReportBanner({ kind, start, end }: { kind: "주간" | "월간"; start: string; end: string }) {
  // 월간은 대부분의 날짜가 속한 달(종료일 기준)로 표기 — 7/27~8/23 이면 "8월"
  const [y, m] = (kind === "월간" ? end : start).split("-");
  return (
    <header
      className="overflow-hidden rounded-3xl px-5 py-5 text-white shadow-lg shadow-[#0ea5e9]/25 sm:px-8 sm:py-7"
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
      {images.map((src) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={src} src={src} alt="실제 화면 캡처" className="w-full rounded-2xl border border-ink/10" />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// STEP 1 — 주간 계획표
// ─────────────────────────────────────────────────────────────

function PlanStep() {
  const dates = Array.from({ length: 7 }, (_, i) => addDays(DEMO_FEATURED_WEEK.start_date, i));
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
      <Frame label="멘토와 함께 세우는 주간 계획표 (예시)">
        <WeeklyPlanView plan={DEMO_PLAN} dates={dates} weekLabel={DEMO_STUDENT.featuredCumWeek} />
      </Frame>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// STEP 2 — 매일 카톡 관리
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
  return (
    <div className="mx-auto max-w-[460px] overflow-hidden rounded-[28px] border border-ink/10 shadow-[0_12px_40px_rgba(15,40,80,0.12)]">
      <div className="flex items-center justify-between bg-[#BACEE0] px-4 py-3">
        <span className="text-lg text-ink/60">‹</span>
        <div className="text-[15px] font-bold text-ink/85">
          {DEMO_STUDENT.name} 관리방 <span className="font-medium text-ink/40">2</span>
        </div>
        <span className="text-lg text-ink/50">≡</span>
      </div>
      <div className="space-y-1.5 bg-[#BACEE0] px-3 pb-5">
        {DEMO_CHAT.map((m, i) => {
          if ("kind" in m) {
            return (
              <div key={i} className="flex justify-center py-2">
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
                  className="grid h-28 w-28 place-items-center text-center text-[11px] font-semibold text-white/90"
                  style={{
                    backgroundImage:
                      k === 0
                        ? "linear-gradient(135deg,#94a3b8,#64748b)"
                        : "linear-gradient(135deg,#a8b8c8,#7b8ca0)",
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
            <div key={i} className={`flex gap-2 ${mine ? "justify-end" : ""} ${first ? "pt-2" : ""}`}>
              {!mine && (
                <div className="w-9 shrink-0">
                  {first && (
                    <div className="grid h-9 w-9 place-items-center rounded-[14px] bg-gradient-to-br from-sky-400 to-sky-600 text-[13px] font-bold text-white">
                      {DEMO_STUDENT.mentor[0]}
                    </div>
                  )}
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
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// STEP 3 — 주간 줌 컨설팅
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
            {DEMO_ZOOM.planCheck.map((p) => (
              <div key={p.subject} className="rounded-2xl bg-slate-50 p-3.5">
                <div className="text-[13px] font-bold text-ink/80">[{p.subject}]</div>
                <div className="mt-1 text-[14px] leading-relaxed text-ink/75">{p.text}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 text-[13px] font-bold text-sky-700">2. 학생 질문 &amp; 멘토 답변</div>
          <div className="mt-2 space-y-3">
            {DEMO_ZOOM.qna.map((x) => (
              <div key={x.q} className="rounded-2xl border border-ink/[0.07] p-3.5">
                <div className="flex gap-2 text-[14px] font-bold text-ink/85">
                  <span className="text-sky-600">Q.</span>
                  {x.q}
                </div>
                <div className="mt-2 flex gap-2 text-[14px] leading-relaxed text-ink/70">
                  <span className="font-bold text-fuchsia">A.</span>
                  <span>{x.a}</span>
                </div>
              </div>
            ))}
          </div>
        </Frame>
      </div>
    </>
  );
}

function ZoomMock() {
  const planRows = [
    { d: "월", t: "영단어 복습 · 미적분 1강 · 문학 2지문", ok: true },
    { d: "화", t: "영단어 · 극한의 성질 2강 · 문학", ok: true },
    { d: "수", t: "문학 표시 연습 · 미적분 2강 문제", ok: false },
    { d: "목", t: "대화 중심 읽기 · 헷갈린 문제 다시", ok: true },
    { d: "금", t: "영어 모의고사 실전 · 빈칸 오답", ok: false },
  ];
  return (
    <div className="overflow-hidden rounded-3xl bg-[#1c1c1e] text-white shadow-[0_12px_40px_rgba(0,0,0,0.25)]">
      {/* 상단 */}
      <div className="flex items-center justify-between px-4 py-2.5 text-[12px]">
        <span className="flex items-center gap-1.5 text-white/70">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          주간 컨설팅
        </span>
        <span className="font-semibold text-white/85">SKY MATE · {DEMO_STUDENT.featuredCumWeek}주차</span>
        <span className="flex items-center gap-1.5 text-white/70">
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
          기록 중 32:14
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
              <div className="text-[11px] font-bold text-sky-600">달성률 89%</div>
            </div>
            <div className="mt-2 space-y-1.5">
              {planRows.map((r) => (
                <div key={r.d} className="flex items-center gap-2 rounded-md bg-slate-50 px-2 py-1.5 text-[11.5px]">
                  <span className="w-4 font-bold text-ink/50">{r.d}</span>
                  <span className="flex-1 truncate text-ink/75">{r.t}</span>
                  <span className={`text-[10.5px] font-bold ${r.ok ? "text-sky-600" : "text-rose"}`}>
                    {r.ok ? "완료" : "일부 밀림"}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-2.5 rounded-md border-l-[3px] border-fuchsia bg-pink-50 px-2 py-1.5 text-[11.5px] text-ink/75">
              다음 주: 인강 1강 → 관련 문제 → 틀린 문제 확인을 한 세트로!
            </div>
          </div>
        </div>

        {/* 참가자 */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
          <ZoomTile name={`${DEMO_STUDENT.mentor} 멘토`} initial={DEMO_STUDENT.mentor[0]} speaking />
          <ZoomTile name={DEMO_STUDENT.name} initial={DEMO_STUDENT.name.slice(1, 2)} />
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
  );
}

function ZoomTile({ name, initial, speaking }: { name: string; initial: string; speaking?: boolean }) {
  return (
    <div
      className={`relative grid aspect-[4/3] place-items-center rounded-xl bg-[#2c2c2e] ${
        speaking ? "ring-2 ring-emerald-400" : ""
      }`}
    >
      <div
        className={`grid h-12 w-12 place-items-center rounded-full text-lg font-bold ${
          speaking ? "bg-gradient-to-br from-sky-400 to-sky-600" : "bg-gradient-to-br from-pink-300 to-fuchsia"
        }`}
      >
        {initial}
      </div>
      <div className="absolute bottom-1.5 left-1.5 rounded bg-black/50 px-1.5 py-0.5 text-[10.5px]">{name}</div>
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
// STEP 4 — 주간 레포트
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

  const comments = [
    { label: "이번 주에 잘 한 것", value: report.good_points },
    { label: "이번 주에 아쉬운 것", value: report.improvement_points },
    { label: "다음 주에 하면 좋을 것", value: report.next_week_actions },
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

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <WeeklyStat label="평균 기상 시간" value={stats.avgWake} />
          <WeeklyStat label="평균 순공 시간" value={minutesToHm(stats.avgStudy)} />
          <WeeklyStat label="과제 달성률" value={`${stats.taskRate}%`} sub={`${stats.submitted}/${stats.totalDay}일`} />
        </div>

        <div className="mb-7">
          <DonutCharts report={report} />
        </div>

        <h3 className="mb-3 text-base font-bold">멘토 총평</h3>
        <div className="mb-7 space-y-3">
          {comments.map((c) => (
            <div key={c.label} className="rounded-2xl border border-ink/10 p-4 sm:p-5">
              <div className="mb-1.5 text-sm font-bold">{c.label}</div>
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-ink/80">{c.value}</div>
            </div>
          ))}
        </div>

        <h3 className="mb-3 text-base font-bold">일별 기록</h3>
        <div className="space-y-3">
          {days.map((day, i) => (
            <PreviewDayCard key={day.date} day={day} weekday={WEEKDAY_KO[i]} />
          ))}
        </div>
        {!showAll && (
          <button
            onClick={() => setShowAll(true)}
            className="mt-3 w-full rounded-2xl border border-sky-200 bg-sky-50 py-3 text-[14px] font-semibold text-sky-700 transition hover:bg-sky-100"
          >
            나머지 5일 기록 더 보기
          </button>
        )}
      </Frame>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// STEP 5 — 월간 레포트
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

  const weekRates = DEMO_WEEKS.map((w) => {
    const counted = w.day_data.filter((d) => d.status !== "paused");
    const submitted = w.day_data.filter((d) => d.status === "submitted").length;
    return { week: `${w.week_number}주차`, rate: Math.round((submitted / counted.length) * 100), hasData: true };
  });
  const studyTrend = allDays.map((d) => ({
    day: d.date.slice(5),
    minutes: d.study_minutes ?? 0,
    category: studyCategory(d, stats.avgStudy),
  }));

  return (
    <>
      <StepHeader
        n={5}
        title="매달, 한 달의 변화를 한눈에 보여드려요"
        desc="4주 동안의 기상·순공 시간·과제 완료율 추이를 그래프로 정리하고, 멘토가 과목별로 무엇이 달라졌는지와 다음 달 코칭 방향을 자세히 적어요."
      />
      <Frame label="매달 받아보는 월간 레포트 (예시)">
        <ReportBanner kind="월간" start={DEMO_STUDENT.cycleStart} end={DEMO_STUDENT.cycleEnd} />
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

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MonthlyStat label="월 평균 기상 시간" value={stats.avgWake} />
          <MonthlyStat
            label="월 평균 순공 시간"
            value={`${Math.floor(stats.avgStudy / 60)}H ${stats.avgStudy % 60}M`}
          />
          <MonthlyStat label="과제 완료율" value={`${stats.taskRate}%`} />
        </div>

        <div className="mb-6 rounded-2xl border border-ink/[0.05] p-5" style={CARD_BG}>
          <SectionTitle>주차별 과제 완료율</SectionTitle>
          <WeekRateBars weekRates={weekRates} />
        </div>

        <div className="mb-6 rounded-2xl border border-ink/[0.05] p-4 sm:p-5" style={CARD_BG}>
          <SectionTitle>기상 시간 기록</SectionTitle>
          <WakeCalendar days={allDays} />
          <WakeLegend />
        </div>

        <div className="mb-6 rounded-2xl border border-ink/10 p-4 sm:p-5" style={CARD_BG_INDIGO}>
          <SectionTitle>일별 공부 시간</SectionTitle>
          <StudyTrendChart data={studyTrend} avgMin={stats.avgStudy} />
        </div>

        <div className="space-y-4">
          <CommentField label="월간 멘토 총평" icon="📝" variant="summary" value={DEMO_MONTHLY.month_summary || ""} readOnly />
          <CommentField
            label="다음 달 코칭 방향"
            icon="🎯"
            variant="bullets"
            value={DEMO_MONTHLY.next_month_direction || ""}
            readOnly
          />
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
          <div key={i} className="rounded-3xl border border-ink/[0.06] bg-white p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-sky-50 px-2 py-0.5 text-[12px] font-bold text-sky-700">{r.tag}</span>
              {r.change && (
                <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[12px] font-bold text-emerald-700">{r.change}</span>
              )}
            </div>
            <p className="mt-3 text-[15px] leading-relaxed text-ink/80">“{r.quote}”</p>
            <div className="mt-2 text-[12px] text-ink/45">{r.who}</div>
          </div>
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
