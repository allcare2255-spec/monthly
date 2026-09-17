"use client";

// 체험(/demo) 단계들이 함께 쓰는 화면 부품 — 단계 머리말, 카톡방, 줌 화면 등.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { DEMO_STUDENT, type ChatMessage, type ChatSender } from "./demo-data";
import { Reveal, useInView, usePrefersReducedMotion } from "./demo-motion";

export function StepHeader({ n, title, desc }: { n: number; title: string; desc: ReactNode }) {
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

export function Points({ items }: { items: { icon: string; title: string; text: string }[] }) {
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

export function Frame({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <Reveal delay={250} from="scale">
      <div className="rounded-3xl border border-ink/[0.06] bg-white p-4 shadow-[0_8px_30px_rgba(15,40,80,0.06)] sm:p-6">
        {label && <div className="mb-3 text-[12px] font-semibold text-ink/40">{label}</div>}
        {children}
      </div>
    </Reveal>
  );
}

export function CaptureGallery({ images }: { images: string[] }) {
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

export function ReplayButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mx-auto mt-3 flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-ink/60 shadow-sm ring-1 ring-ink/10 transition hover:text-sky-700 active:scale-95"
    >
      ↻ 다시 보기
    </button>
  );
}

// 가운데 연결선 설명 — 앞 단계와 이어지는 흐름을 한 줄로 보여준다
export function FlowNote({ children }: { children: ReactNode }) {
  return (
    <Reveal>
      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-sky-200" />
        <div className="rounded-full bg-sky-50 px-3.5 py-1.5 text-center text-[12.5px] font-bold text-sky-700">{children}</div>
        <div className="h-px flex-1 bg-sky-200" />
      </div>
    </Reveal>
  );
}

// ─────────────────────────────────────────────────────────────
// 카톡방 — 메시지가 하나씩 도착한다
// ─────────────────────────────────────────────────────────────

/** ⟦…⟧ 로 감싼 부분(링크·학교명)은 모자이크처럼 흐리게 */
function Masked({ text }: { text: string }) {
  const parts = text.split(/(⟦[^⟧]*⟧)/);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("⟦") ? (
          <span
            key={i}
            aria-label="가려진 정보"
            className="select-none rounded-[3px] bg-sky-200/60 px-0.5 text-sky-800 [filter:blur(3.5px)]"
          >
            {p.slice(1, -1)}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

const SENDER_NAME: Record<Exclude<ChatSender, "student">, string> = {
  mentor: `${DEMO_STUDENT.mentor} 멘토`,
  manager: "스카이메이트 매니저",
};

export function MentorAvatar() {
  return (
    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[14px] bg-gradient-to-br from-sky-400 to-sky-600 text-[13px] font-bold text-white">
      {DEMO_STUDENT.mentor[0]}
    </div>
  );
}

function ManagerAvatar() {
  return (
    <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-[14px] bg-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.jpg" alt="" className="h-7 w-7 object-contain" />
    </div>
  );
}

function msgDelay(m: ChatMessage) {
  if ("kind" in m) return 350;
  if (m.image) return 900;
  if (m.long) return 2400;
  return Math.min(1500, 650 + (m.text?.length ?? 30) * 5);
}

export function KakaoRoom({
  title,
  count,
  messages,
  height = 540,
  pinned,
  mentorName,
}: {
  title: string;
  count: number;
  messages: ChatMessage[];
  height?: number;
  /** 채팅창 위에 고정되는 공지 한 줄 */
  pinned?: string;
  /** 멘토 말풍선 위 이름 (기본: 담당 멘토 이름) */
  mentorName?: string;
}) {
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
    messages.forEach((m, i) => {
      timers.push(setTimeout(() => setShown(i + 1), t));
      t += msgDelay(m);
    });
    return () => timers.forEach(clearTimeout);
  }, [inView, reduced, run, messages]);

  const visible = reduced ? messages.length : shown;
  const done = visible >= messages.length;

  // 새 메시지가 오면 채팅창을 내린다 — 장문은 첫머리부터 읽히게 윗부분에 맞춘다
  useEffect(() => {
    const box = scrollRef.current;
    if (!box) return;
    const last = box.querySelector<HTMLElement>("[data-msg]:last-of-type");
    if (last && last.offsetHeight > box.clientHeight - 40) {
      box.scrollTo({ top: last.offsetTop - 12, behavior: "smooth" });
    } else {
      box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
    }
  }, [visible]);

  function replay() {
    setShown(0);
    setRun((r) => r + 1);
  }

  return (
    <Reveal delay={250} from="scale">
      <div ref={wrapRef} className="mx-auto max-w-[460px]">
        <div className="overflow-hidden rounded-[28px] border border-ink/10 shadow-[0_12px_40px_rgba(15,40,80,0.12)]">
          <div className="flex items-center justify-between gap-2 bg-[#BACEE0] px-4 py-3">
            <span className="text-lg text-ink/60">‹</span>
            <div className="min-w-0 truncate text-[15px] font-bold text-ink/85">
              {title} <span className="font-medium text-ink/40">{count}</span>
            </div>
            <span className="text-lg text-ink/50">≡</span>
          </div>
          {pinned && (
            <div className="flex items-center gap-2 border-t border-black/5 bg-white/95 px-3.5 py-2 text-[12px] text-ink/75">
              <span className="shrink-0">📌</span>
              <span className="truncate">{pinned}</span>
            </div>
          )}
          <div
            ref={scrollRef}
            className="relative space-y-1.5 overflow-y-auto bg-[#BACEE0] px-3 pb-5 [scrollbar-width:thin]"
            style={{ height }}
          >
            {messages.slice(0, visible).map((m, i) => {
              if ("kind" in m) {
                return (
                  <div key={i} data-msg className="flex animate-[demoMsgIn_.35s_ease] justify-center py-2">
                    <span
                      className={`px-3 py-1 text-center text-[11px] text-white ${
                        m.kind === "date" ? "rounded-full bg-black/10" : "rounded-xl bg-black/[0.06] text-ink/55"
                      }`}
                    >
                      {m.text}
                    </span>
                  </div>
                );
              }
              const prev = messages[i - 1];
              const first = !prev || "kind" in prev || prev.from !== m.from;
              const mine = m.from === "student";
              return (
                <div
                  key={i}
                  data-msg
                  className={`flex animate-[demoMsgIn_.4s_cubic-bezier(.2,.8,.2,1)] gap-2 ${mine ? "justify-end" : ""} ${first ? "pt-2" : ""}`}
                  style={{ transformOrigin: mine ? "bottom right" : "bottom left" }}
                >
                  {!mine && (
                    <div className="w-9 shrink-0">
                      {first && (m.from === "manager" ? <ManagerAvatar /> : <MentorAvatar />)}
                    </div>
                  )}
                  <div className={`flex min-w-0 max-w-[78%] flex-col ${mine ? "items-end" : "items-start"}`}>
                    {!mine && first && <div className="mb-1 text-[12px] text-ink/70">{m.from === "mentor" && mentorName ? mentorName : SENDER_NAME[m.from as "mentor" | "manager"]}</div>}
                    <div className={`flex min-w-0 items-end gap-1.5 ${mine ? "flex-row-reverse" : ""}`}>
                      <Bubble m={m} mine={mine} />
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

type TextMsg = Exclude<ChatMessage, { kind: string }>;

function Bubble({ m, mine }: { m: TextMsg; mine: boolean }) {
  if (m.photos) {
    return (
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
              {m.photoLabels?.[k] ?? "공부 인증"}
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (m.image === "problem") return <ProblemPhoto />;
  if (m.image === "solution") return <SolutionPhoto />;
  if (m.image === "progress") return <ProgressPhoto />;
  if (m.long) return <LongBubble text={m.text || ""} />;
  return (
    <div
      className={`min-w-0 whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-[13.5px] leading-[1.55] ${
        mine ? "rounded-tr-md bg-[#FEE500] text-ink" : "rounded-tl-md bg-white text-ink"
      }`}
    >
      <Masked text={m.text || ""} />
    </div>
  );
}

function LongBubble({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative min-w-0 rounded-2xl rounded-tl-md bg-white px-3 py-2.5 text-ink">
      <div className="mb-1 inline-block rounded-md bg-sky-50 px-1.5 py-0.5 text-[10.5px] font-bold text-sky-700">
        오늘의 장문 피드백
      </div>
      <p
        className="overflow-hidden whitespace-pre-wrap break-words text-[13.5px] leading-[1.6] transition-[max-height] duration-500"
        style={{ maxHeight: open ? 2400 : 230 }}
      >
        {text}
      </p>
      {!open && (
        <div className="pointer-events-none absolute inset-x-0 bottom-11 h-14 bg-gradient-to-b from-transparent to-white" />
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="mt-1.5 h-8 w-full rounded-lg bg-sky-50 text-[12px] font-bold text-sky-700 transition hover:bg-sky-100"
      >
        {open ? "접기" : `전체 보기 (${text.length.toLocaleString()}자)`}
      </button>
    </div>
  );
}

// 학생이 찍어 보낸 문제 사진 자리 (공책 느낌)
function ProblemPhoto() {
  return (
    <div
      className="w-[210px] animate-[demoPop_.45s_ease_both] overflow-hidden rounded-2xl border border-black/5 p-3 text-ink shadow-sm"
      style={{
        backgroundColor: "#fffdf6",
        backgroundImage: "repeating-linear-gradient(transparent 0 21px, #e6eef7 21px 22px)",
      }}
    >
      <div className="text-[10px] font-bold text-ink/40">📷 문제 사진</div>
      <div className="mt-1 text-[12px] font-semibold leading-[22px]">
        07. 다음 극한값을 구하시오.
        <div className="mt-1 text-center font-serif text-[15px]">
          lim<sub className="text-[9px]">x→1</sub>{" "}
          <span className="inline-flex flex-col items-center align-middle leading-tight">
            <span className="border-b border-ink/70 px-1">x² + x − 2</span>
            <span>x − 1</span>
          </span>
        </div>
      </div>
      <div className="mt-1 text-right font-[cursive] text-[12px] text-rose">1을 넣으면 0/0 …?? 😵</div>
    </div>
  );
}

// 멘토가 손으로 풀어 보낸 풀이 사진 자리
function SolutionPhoto() {
  return (
    <div className="w-[210px] animate-[demoPop_.45s_ease_both] overflow-hidden rounded-2xl border border-black/5 bg-white p-3 text-ink shadow-sm">
      <div className="text-[10px] font-bold text-ink/40">✍️ 멘토 풀이</div>
      <div className="mt-1.5 space-y-1 font-serif text-[13px] leading-snug">
        <div>
          (x² + x − 2) = <span className="rounded bg-yellow-100 px-0.5">(x − 1)(x + 2)</span>
        </div>
        <div>
          → <span className="line-through decoration-rose">(x − 1)</span> 약분
        </div>
        <div>→ lim (x + 2)</div>
        <div className="font-bold text-sky-700">= 1 + 2 = 3 ✓</div>
      </div>
      <div className="mt-1.5 rounded-md bg-pink-50 px-1.5 py-1 text-[10.5px] font-semibold text-fuchsia">
        0/0 꼴 → 인수분해 · 약분 먼저!
      </div>
    </div>
  );
}

// 멘토가 학생 계획표를 옮겨 적고 체크한 '계획 달성현황' 사진 자리
const PROGRESS_ROWS = [
  { t: "[영단어] Day 13~15", ok: true },
  { t: "[영어] 모의고사 70분 실전", ok: true },
  { t: "[영어] 빈칸 오답 근거 밑줄", ok: true },
  { t: "[미적분] 3강 문제 풀이", ok: false },
];

function ProgressPhoto() {
  const done = PROGRESS_ROWS.filter((r) => r.ok).length;
  return (
    <div className="w-[210px] animate-[demoPop_.45s_ease_both] overflow-hidden rounded-2xl border border-black/5 bg-white text-ink shadow-sm">
      <div className="flex items-center justify-between bg-sky-600 px-3 py-1.5 text-white">
        <span className="text-[11px] font-bold">8/21(금) 계획 달성현황</span>
        <span className="text-[11px] font-extrabold tabular-nums">{Math.round((done / PROGRESS_ROWS.length) * 100)}%</span>
      </div>
      <div className="space-y-1 p-2.5">
        {PROGRESS_ROWS.map((r) => (
          <div key={r.t} className="flex items-center gap-1.5 text-[11px]">
            <span
              className={`grid h-3.5 w-3.5 shrink-0 place-items-center rounded-[4px] text-[9px] font-bold text-white ${
                r.ok ? "bg-sky-500" : "bg-rose"
              }`}
            >
              {r.ok ? "✓" : "✕"}
            </span>
            <span className={r.ok ? "text-ink/75" : "text-ink/45 line-through"}>{r.t}</span>
          </div>
        ))}
        <div className="pt-1 text-right text-[10px] font-semibold text-ink/45">순공 3H 29M</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 줌 화면 — 타이머 · 말하는 사람 · 실시간 자막, 가운데는 화면 공유
// ─────────────────────────────────────────────────────────────

export function ZoomMock({
  badge,
  startSec,
  captions,
  screen,
}: {
  badge: string;
  startSec: number;
  captions: { who: "mentor" | "student"; text: string }[];
  screen: (inView: boolean) => ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, 0.3);
  const reduced = usePrefersReducedMotion();

  const [sec, setSec] = useState(startSec);
  useEffect(() => {
    if (!inView || reduced) return;
    const id = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [inView, reduced]);

  // 실시간 자막: 한 글자씩 → 잠시 멈춤 → 다음 사람
  const [cap, setCap] = useState(0);
  const [chars, setChars] = useState(0);
  const line = captions[cap];
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
        setCap((c) => (c + 1) % captions.length);
      },
      line.text.length * 42 + 1800,
    );
    return () => {
      clearInterval(id);
      clearTimeout(next);
    };
  }, [inView, reduced, cap, line.text.length, captions.length]);

  const speaking = line.who;
  const typed = reduced ? line.text : line.text.slice(0, chars);

  return (
    <Reveal delay={250} from="scale">
      <div ref={ref} className="overflow-hidden rounded-3xl bg-[#1c1c1e] text-white shadow-[0_12px_40px_rgba(0,0,0,0.25)]">
        <div className="flex items-center justify-between px-4 py-2.5 text-[12px]">
          <span className="flex items-center gap-1.5 text-white/70">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            {badge}
          </span>
          <span className="hidden font-semibold text-white/85 sm:inline">SKY MATE 고등 코칭</span>
          <span className="flex items-center gap-1.5 tabular-nums text-white/70">
            <span className="h-2 w-2 rounded-full bg-red-500" style={{ animation: "demoRec 1.4s infinite" }} />
            기록 중 {String(Math.floor(sec / 60)).padStart(2, "0")}:{String(sec % 60).padStart(2, "0")}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2 px-2 pb-2 sm:grid-cols-[1fr_180px]">
          <div className="relative rounded-xl bg-[#2c2c2e] p-3 sm:p-4">
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-md bg-emerald-500/90 px-2 py-0.5 text-[10.5px] font-semibold">
              {DEMO_STUDENT.mentor} 님의 화면 공유
            </div>
            <div className="rounded-lg bg-white p-3 text-ink sm:p-4">{screen(inView)}</div>

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

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
            <ZoomTile name={`${DEMO_STUDENT.mentor} 멘토`} initial={DEMO_STUDENT.mentor[0]} speaking={speaking === "mentor"} tone="mentor" />
            <ZoomTile name={DEMO_STUDENT.name} initial={DEMO_STUDENT.name.slice(1, 2)} speaking={speaking === "student"} tone="student" />
          </div>
        </div>

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
