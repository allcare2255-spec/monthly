"use client";

// 체험 페이지(/demo) 전용 움직임 도우미.
// 외부 애니메이션 라이브러리 없이 IntersectionObserver + requestAnimationFrame + CSS 로만 구현한다.
// 모든 움직임은 "화면에 들어왔을 때" 한 번 시작하고, 동작 줄이기(prefers-reduced-motion) 설정이면 곧바로 최종 상태를 보여준다.
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

export function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(REDUCED_QUERY);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(REDUCED_QUERY).matches,
    () => false,
  );
}

/** 요소가 화면에 한 번이라도 들어오면 true 가 된다. */
export function useInView<T extends Element>(ref: RefObject<T | null>, threshold = 0.25) {
  const [inView, setInView] = useState(false);
  // IntersectionObserver 가 없는 오래된 브라우저에서는 내용이 숨은 채로 남지 않게 바로 보여준다
  const unsupported = typeof window !== "undefined" && !("IntersectionObserver" in window);
  useEffect(() => {
    const el = ref.current;
    if (!el || inView || unsupported) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, threshold, inView, unsupported]);
  return inView || unsupported;
}

/** start 가 true 가 되면 0 → 1 로 duration 동안 부드럽게 증가하는 진행도. */
export function useProgress(start: boolean, duration = 1200, delay = 0) {
  const reduced = usePrefersReducedMotion();
  const [p, setP] = useState(0);
  useEffect(() => {
    if (!start || reduced) return;
    let raf = 0;
    let t0 = 0;
    const timer = setTimeout(() => {
      const tick = (now: number) => {
        if (!t0) t0 = now;
        const x = Math.min(1, (now - t0) / duration);
        setP(1 - Math.pow(1 - x, 3)); // easeOutCubic
        if (x < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [start, duration, delay, reduced]);
  return reduced ? 1 : p;
}

/** start 후 interval 마다 1씩 증가해 total 에서 멈추는 카운터 (순차 등장용). */
export function useStepper(start: boolean, total: number, interval: number, delay = 0) {
  const reduced = usePrefersReducedMotion();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!start || reduced) return;
    let id: ReturnType<typeof setInterval> | undefined;
    let cur = 0;
    const timer = setTimeout(() => {
      id = setInterval(() => {
        cur += 1;
        setN(cur);
        if (cur >= total && id) clearInterval(id);
      }, interval);
    }, delay);
    return () => {
      clearTimeout(timer);
      if (id) clearInterval(id);
    };
  }, [start, total, interval, delay, reduced]);
  return reduced ? total : n;
}

/** 화면에 들어오면 아래에서 떠오르며 나타나는 블록. */
export function Reveal({
  children,
  delay = 0,
  className = "",
  from = "up",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  from?: "up" | "left" | "scale";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, 0.12);
  const hidden: CSSProperties =
    from === "left"
      ? { opacity: 0, transform: "translateX(-14px)" }
      : from === "scale"
        ? { opacity: 0, transform: "scale(0.96)" }
        : { opacity: 0, transform: "translateY(18px)" };
  return (
    <div
      ref={ref}
      className={`demo-reveal ${className}`}
      style={{
        transition: `opacity .6s ease ${delay}ms, transform .6s cubic-bezier(.2,.8,.2,1) ${delay}ms`,
        ...(inView ? { opacity: 1, transform: "none" } : hidden),
      }}
    >
      {children}
    </div>
  );
}

/** "06:55" 같은 시각을 06:00 부터 올라가며 보여준다. */
export function hmFromProgress(targetHm: string, p: number, fromMin = 6 * 60) {
  const [h, m] = targetHm.split(":").map(Number);
  const target = h * 60 + m;
  const cur = Math.round(fromMin + (target - fromMin) * p);
  return `${String(Math.floor(cur / 60)).padStart(2, "0")}:${String(cur % 60).padStart(2, "0")}`;
}

/** 움직임 전용 전역 CSS (한 번만 렌더). */
export function MotionStyles() {
  // 기상 달력 칸: 행(1~5) × 열(1~7) 순서대로 톡톡 튀어나오도록 지연을 준다.
  const wakeDelays = Array.from({ length: 6 }, (_, r) =>
    Array.from(
      { length: 7 },
      (_, c) =>
        `.demo-wake.is-in > div > div:nth-child(${r + 2}) > :nth-child(${c + 1}){animation-delay:${(r * 7 + c) * 38}ms}`,
    ).join(""),
  ).join("");
  // 공부 시간 그래프 점: 28개 순서대로
  const dotDelays = Array.from(
    { length: 31 },
    (_, i) => `.demo-trend.is-in svg circle:nth-of-type(${i + 1}){animation-delay:${600 + i * 45}ms}`,
  ).join("");

  return (
    <style>{`
@keyframes demoFade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes demoPop{0%{opacity:0;transform:scale(.6)}70%{opacity:1;transform:scale(1.06)}100%{opacity:1;transform:scale(1)}}
@keyframes demoMsgIn{from{opacity:0;transform:translateY(10px) scale(.96)}to{opacity:1;transform:none}}
@keyframes demoDraw{from{stroke-dashoffset:2400}to{stroke-dashoffset:0}}
@keyframes demoAreaIn{from{opacity:0}to{opacity:1}}
@keyframes demoBar{0%,100%{transform:scaleY(.35)}50%{transform:scaleY(1)}}
@keyframes demoCaret{0%,49%{opacity:1}50%,100%{opacity:0}}
@keyframes demoShine{0%{transform:translateX(-120%)}60%,100%{transform:translateX(220%)}}
@keyframes demoRec{0%,100%{opacity:1}50%{opacity:.25}}

.demo-wake .wake-cell,.demo-wake .wake-cell-empty{opacity:0}
.demo-wake.is-in .wake-cell,.demo-wake.is-in .wake-cell-empty{animation:demoPop .45s cubic-bezier(.2,.8,.2,1) both}
${wakeDelays}

.demo-trend svg path[stroke="#6366f1"]{stroke-dasharray:2400;stroke-dashoffset:2400}
.demo-trend svg path[fill^="url"]{opacity:0}
.demo-trend svg circle{opacity:0;transform-box:fill-box;transform-origin:center}
.demo-trend.is-in svg path[stroke="#6366f1"]{animation:demoDraw 1.8s cubic-bezier(.4,0,.2,1) .3s forwards}
.demo-trend.is-in svg path[fill^="url"]{animation:demoAreaIn 1s ease 1.2s forwards}
.demo-trend.is-in svg circle{animation:demoPop .35s ease both}
${dotDelays}

.demo-shine{position:relative;overflow:hidden}
.demo-shine::after{content:"";position:absolute;inset:0;width:40%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.35),transparent);animation:demoShine 2.8s ease-in-out infinite}

@media (prefers-reduced-motion: reduce){
  .demo-reveal{transition:none!important;opacity:1!important;transform:none!important}
  .demo-wake .wake-cell,.demo-wake .wake-cell-empty,.demo-trend svg circle,.demo-trend svg path[fill^="url"]{opacity:1!important;animation:none!important}
  .demo-trend svg path[stroke="#6366f1"]{stroke-dashoffset:0!important;animation:none!important}
  .demo-shine::after{display:none}
}
`}</style>
  );
}

/** 화면에 들어오면 is-in 클래스를 붙이는 래퍼 (CSS 애니메이션 트리거용). */
export function InViewClass({ className, children, style }: { className: string; children: ReactNode; style?: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, 0.2);
  return (
    <div ref={ref} className={`${className} ${inView ? "is-in" : ""}`} style={style}>
      {children}
    </div>
  );
}
