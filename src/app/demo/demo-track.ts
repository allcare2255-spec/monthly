"use client";

/**
 * 체험 페이지(/demo) 방문 기록.
 * - 수집 결과는 사이트 어디에도 노출하지 않는다. 관리자 탭(/admin/demo)에서만 본다.
 * - 전송 실패는 무시한다. 기록이 페이지 동작을 방해하면 안 된다.
 */

const VID_KEY = "sm_demo_vid";     // 기기 단위 (재방문 판정)
const VISIT_KEY = "sm_demo_visits";
const SID_KEY = "sm_demo_sid";     // 방문 1회
const CODE_KEY = "sm_demo_code";   // 개인 링크 코드

type Nav = "next" | "back" | "chip" | "auto";

let ready = false;
let sid = "";
let vid = "";
let code: string | null = null;
let visitNo = 1;

let t0 = 0;                 // 페이지 진입 시각
let stepAt = 0;             // 현재 단계 진입 시각
let activeMs = 0;           // 화면을 실제로 보고 있던 누적 시간
let activeFrom = 0;         // 현재 visible 구간 시작
let maxStep = 0;
let backCount = 0;
let chipCount = 0;
let scrollPct = 0;
let cur = { index: 0, key: "", label: "" };
let pingTimer: ReturnType<typeof setInterval> | null = null;
let left = false;

function uid() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}
function get(store: Storage | null, k: string) {
  try {
    return store?.getItem(k) ?? null;
  } catch {
    return null;
  }
}
function put(store: Storage | null, k: string, v: string) {
  try {
    store?.setItem(k, v);
  } catch {
    /* 사파리 시크릿 모드 등 — 무시 */
  }
}

function now() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function touchActive() {
  if (activeFrom) {
    activeMs += now() - activeFrom;
    activeFrom = document.visibilityState === "visible" ? now() : 0;
  } else if (document.visibilityState === "visible") {
    activeFrom = now();
  }
}

function send(event: string, extra: Record<string, unknown> = {}) {
  if (!ready) return;
  touchActive();
  const body = {
    v: 1,
    session_id: sid,
    visitor_id: vid,
    code,
    visit_no: visitNo,
    event,
    step_index: cur.index,
    step_key: cur.key,
    step_label: cur.label,
    max_step: maxStep,
    dwell_ms: Math.round(now() - t0),
    active_ms: Math.round(activeMs),
    scroll_pct: scrollPct,
    back_count: backCount,
    chip_count: chipCount,
    ...extra,
  };
  const url = "/api/demo/track";
  try {
    const blob = new Blob([JSON.stringify(body)], { type: "application/json" });
    if (navigator.sendBeacon?.(url, blob)) return;
  } catch {
    /* fall through */
  }
  try {
    void fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* 무시 */
  }
}

function onScroll() {
  const doc = document.documentElement;
  const scrollable = doc.scrollHeight - window.innerHeight;
  const pct = scrollable > 0 ? Math.round(((window.scrollY || 0) / scrollable) * 100) : 100;
  if (pct > scrollPct) scrollPct = Math.min(100, Math.max(0, pct));
}

function leave(reason: string) {
  if (left) return;
  left = true;
  send("leave", { nav: reason });
}

/** 페이지 진입 — 마운트 시 한 번만 호출한다. */
export function trackInit(first: { index: number; key: string; label: string }) {
  if (ready || typeof window === "undefined") return;

  vid = get(localStorage, VID_KEY) || uid();
  put(localStorage, VID_KEY, vid);

  sid = get(sessionStorage, SID_KEY) || "";
  const fresh = !sid;
  if (fresh) {
    sid = uid();
    put(sessionStorage, SID_KEY, sid);
    visitNo = Number(get(localStorage, VISIT_KEY) || "0") + 1;
    put(localStorage, VISIT_KEY, String(visitNo));
  } else {
    visitNo = Number(get(localStorage, VISIT_KEY) || "1");
  }

  const qs = new URLSearchParams(window.location.search);
  code = qs.get("c") || qs.get("code") || get(sessionStorage, CODE_KEY);
  if (code) put(sessionStorage, CODE_KEY, code);

  t0 = now();
  stepAt = t0;
  activeFrom = document.visibilityState === "visible" ? t0 : 0;
  cur = first;
  maxStep = first.index;
  ready = true;

  send("view", {
    nav: "auto",
    referrer: document.referrer || null,
    entry_path: window.location.pathname + window.location.search,
    screen_w: window.screen?.width ?? null,
    screen_h: window.screen?.height ?? null,
    viewport_w: window.innerWidth,
    viewport_h: window.innerHeight,
    dpr: window.devicePixelRatio ?? null,
    lang: navigator.language || null,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
  });

  window.addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("visibilitychange", () => {
    touchActive();
    if (document.visibilityState === "hidden") send("leave", { nav: "hidden" });
    else left = false;
  });
  window.addEventListener("pagehide", () => leave("pagehide"));

  // 도중에 브라우저가 닫혀도 체류 시간이 남도록 주기적으로 한 번씩 보낸다.
  pingTimer = setInterval(() => {
    if (document.visibilityState === "visible") send("ping");
  }, 20000);
}

/** 단계 이동 */
export function trackStep(index: number, key: string, label: string, nav: Nav) {
  if (!ready) return;
  if (nav === "back") backCount += 1;
  if (nav === "chip") chipCount += 1;
  const stepMs = Math.round(now() - stepAt);
  const prevScroll = scrollPct;
  const prev = cur;
  cur = { index, key, label };
  if (index > maxStep) maxStep = index;
  stepAt = now();
  scrollPct = 0;
  send("step", {
    nav,
    step_ms: stepMs,
    scroll_pct: prevScroll,
    from_index: prev.index,
  });
}

/** 상담 버튼 클릭 */
export function trackConsult(from: "header" | "footer") {
  send("consult", { consult_from: from, step_ms: Math.round(now() - stepAt) });
}

export function trackStop() {
  if (pingTimer) clearInterval(pingTimer);
  pingTimer = null;
}
