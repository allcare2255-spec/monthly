import { createHash } from "node:crypto";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * 체험 페이지(/demo) 방문 기록 수집 — 공개 엔드포인트(쓰기 전용).
 * 조회 기능은 없다. 집계는 관리자 탭(/admin/demo)에서만 본다.
 */

const EVENTS = new Set(["view", "step", "consult", "leave", "ping"]);

const str = (v: unknown, max = 300) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
const int = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? Math.trunc(Math.min(v, 2_000_000_000)) : null;
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

function parseUA(ua: string) {
  const s = ua.toLowerCase();
  const inapp = s.includes("kakaotalk")
    ? "kakao"
    : s.includes("naver")
      ? "naver"
      : s.includes("instagram")
        ? "instagram"
        : s.includes(" line/")
          ? "line"
          : s.includes("fban") || s.includes("fbav")
            ? "facebook"
            : null;
  const tablet = s.includes("ipad") || (s.includes("android") && !s.includes("mobile"));
  const mobile = /iphone|ipod|android|windows phone/.test(s);
  const device = tablet ? "tablet" : mobile ? "mobile" : "desktop";
  const os = s.includes("iphone") || s.includes("ipad") || s.includes("ipod")
    ? "iOS"
    : s.includes("android")
      ? "Android"
      : s.includes("windows")
        ? "Windows"
        : s.includes("mac os")
          ? "macOS"
          : null;
  const browser = inapp
    ? "inapp"
    : s.includes("edg/")
      ? "Edge"
      : s.includes("samsungbrowser")
        ? "Samsung"
        : s.includes("whale")
          ? "Whale"
          : s.includes("chrome")
            ? "Chrome"
            : s.includes("firefox")
              ? "Firefox"
              : s.includes("safari")
                ? "Safari"
                : null;
  return { device, os, browser, inapp };
}

/** 원본 IP는 저장하지 않는다 — 재방문 교차 확인용 해시 앞부분만 남긴다. */
function hashIp(ip: string | null) {
  if (!ip) return null;
  return createHash("sha256").update(`skymate-demo:${ip}`).digest("hex").slice(0, 16);
}

export async function POST(req: Request) {
  try {
    const raw = await req.text();
    if (!raw || raw.length > 8000) return new Response(null, { status: 204 });
    const b = JSON.parse(raw) as Record<string, unknown>;

    const event = str(b.event, 20);
    const sessionId = str(b.session_id, 64);
    const visitorId = str(b.visitor_id, 64);
    if (!event || !EVENTS.has(event) || !sessionId || !visitorId) {
      return new Response(null, { status: 204 });
    }

    const h = req.headers;
    const ua = h.get("user-agent") || "";
    const env = parseUA(ua);
    const ip = (h.get("x-forwarded-for") || "").split(",")[0].trim() || null;

    const row = {
      session_id: sessionId,
      visitor_id: visitorId,
      code: str(b.code, 60),
      visit_no: int(b.visit_no),
      event,
      step_index: int(b.step_index),
      step_key: str(b.step_key, 40),
      step_label: str(b.step_label, 40),
      max_step: int(b.max_step),
      dwell_ms: int(b.dwell_ms),
      step_ms: int(b.step_ms),
      active_ms: int(b.active_ms),
      nav: str(b.nav, 20),
      from_index: int(b.from_index),
      scroll_pct: int(b.scroll_pct),
      back_count: int(b.back_count),
      chip_count: int(b.chip_count),
      consult_from: str(b.consult_from, 20),
      referrer: str(b.referrer, 500),
      entry_path: str(b.entry_path, 300),
      device: env.device,
      os: env.os,
      browser: env.browser,
      inapp: env.inapp,
      screen_w: int(b.screen_w),
      screen_h: int(b.screen_h),
      viewport_w: int(b.viewport_w),
      viewport_h: int(b.viewport_h),
      dpr: num(b.dpr),
      lang: str(b.lang, 20),
      tz: str(b.tz, 60),
      ip_hash: hashIp(ip),
      geo_city: str(h.get("x-vercel-ip-city") ? decodeURIComponent(h.get("x-vercel-ip-city")!) : null, 60),
      geo_region: str(h.get("x-vercel-ip-country-region"), 60),
      geo_country: str(h.get("x-vercel-ip-country"), 10),
      ua: ua.slice(0, 400) || null,
    };

    const { error } = await getServiceClient().from("demo_events").insert(row);
    if (error) console.error("[/api/demo/track]", error.message);
  } catch (e) {
    console.error("[/api/demo/track]", e);
  }
  // 수집 실패 여부를 페이지에 알리지 않는다.
  return new Response(null, { status: 204 });
}
