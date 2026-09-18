import { DEMO_STEPS } from "@/app/demo/demo-steps";
import { getServiceClient } from "@/lib/supabase";

export type DemoLink = {
  code: string;
  label: string;
  who_type: string | null;
  grade: string | null;
  channel: string | null;
  contact: string | null;
  memo: string | null;
  created_at: string;
  created_by: string | null;
};

type EventRow = {
  id: number;
  created_at: string;
  visitor_id: string;
  session_id: string;
  code: string | null;
  visit_no: number | null;
  event: string;
  step_index: number | null;
  from_index: number | null;
  max_step: number | null;
  dwell_ms: number | null;
  step_ms: number | null;
  active_ms: number | null;
  nav: string | null;
  scroll_pct: number | null;
  back_count: number | null;
  chip_count: number | null;
  consult_from: string | null;
  referrer: string | null;
  entry_path: string | null;
  device: string | null;
  os: string | null;
  browser: string | null;
  inapp: string | null;
  viewport_w: number | null;
  lang: string | null;
  tz: string | null;
  ip_hash: string | null;
  geo_city: string | null;
  geo_country: string | null;
};

export type DemoSession = {
  sessionId: string;
  visitorId: string;
  code: string | null;
  visitNo: number;
  firstAt: string;
  lastAt: string;
  maxStep: number;
  completed: boolean;
  dwellMs: number;
  activeMs: number;
  consult: string | null;
  backCount: number;
  chipCount: number;
  device: string | null;
  os: string | null;
  browser: string | null;
  inapp: string | null;
  city: string | null;
  referrer: string | null;
  stepMs: number[];
  scrollPct: number[];
  events: number;
};

export type DemoStats = {
  steps: { key: string; label: string }[];
  sessions: DemoSession[];
  summary: {
    visits: number;
    visitors: number;
    repeatVisits: number;
    completed: number;
    consult: number;
    bounce: number;
    avgActiveMs: number;
    medActiveMs: number;
    avgMaxStep: number;
  };
  funnel: { index: number; label: string; reached: number; leftHere: number; avgMs: number }[];
  devices: { label: string; n: number }[];
  sources: { label: string; n: number }[];
};

const LAST = DEMO_STEPS.length - 1;

/** 기간 내 이벤트 전량 — PostgREST 페이지 제한을 피해 1000건씩 끊어 읽는다. */
async function fetchEvents(since: string | null): Promise<EventRow[]> {
  const sb = getServiceClient();
  const out: EventRow[] = [];
  const size = 1000;
  for (let page = 0; page < 200; page++) {
    let q = sb
      .from("demo_events")
      .select(
        "id,created_at,visitor_id,session_id,code,visit_no,event,step_index,from_index,max_step,dwell_ms,step_ms,active_ms,nav,scroll_pct,back_count,chip_count,consult_from,referrer,entry_path,device,os,browser,inapp,viewport_w,lang,tz,ip_hash,geo_city,geo_country",
      )
      .order("id", { ascending: true })
      .range(page * size, page * size + size - 1);
    if (since) q = q.gte("created_at", since);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as EventRow[];
    out.push(...rows);
    if (rows.length < size) break;
  }
  return out;
}

function median(xs: number[]) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

export async function loadDemoStats(days: number | null): Promise<DemoStats> {
  const since = days ? new Date(Date.now() - days * 86400_000).toISOString() : null;
  const rows = await fetchEvents(since);

  const map = new Map<string, DemoSession>();
  for (const r of rows) {
    let s = map.get(r.session_id);
    if (!s) {
      s = {
        sessionId: r.session_id,
        visitorId: r.visitor_id,
        code: r.code,
        visitNo: r.visit_no ?? 1,
        firstAt: r.created_at,
        lastAt: r.created_at,
        maxStep: 0,
        completed: false,
        dwellMs: 0,
        activeMs: 0,
        consult: null,
        backCount: 0,
        chipCount: 0,
        device: r.device,
        os: r.os,
        browser: r.browser,
        inapp: r.inapp,
        city: r.geo_city,
        referrer: r.referrer,
        stepMs: new Array(DEMO_STEPS.length).fill(0),
        scrollPct: new Array(DEMO_STEPS.length).fill(0),
        events: 0,
      };
      map.set(r.session_id, s);
    }
    s.events += 1;
    s.lastAt = r.created_at;
    if (r.code && !s.code) s.code = r.code;
    if (r.referrer && !s.referrer) s.referrer = r.referrer;
    if (r.device && !s.device) s.device = r.device;
    if (r.inapp && !s.inapp) s.inapp = r.inapp;
    if (r.geo_city && !s.city) s.city = r.geo_city;
    s.dwellMs = Math.max(s.dwellMs, r.dwell_ms ?? 0);
    s.activeMs = Math.max(s.activeMs, r.active_ms ?? 0);
    s.maxStep = Math.max(s.maxStep, r.max_step ?? 0, r.step_index ?? 0);
    s.backCount = Math.max(s.backCount, r.back_count ?? 0);
    s.chipCount = Math.max(s.chipCount, r.chip_count ?? 0);
    if (r.event === "consult") s.consult = r.consult_from || "footer";

    // 단계 체류: step 이벤트가 "직전 단계에 머문 시간"을 들고 온다
    if (r.event === "step" && r.from_index != null && r.from_index < DEMO_STEPS.length) {
      s.stepMs[r.from_index] += r.step_ms ?? 0;
      if ((r.scroll_pct ?? 0) > s.scrollPct[r.from_index]) s.scrollPct[r.from_index] = r.scroll_pct ?? 0;
    } else if (r.step_index != null && r.step_index < DEMO_STEPS.length) {
      if ((r.scroll_pct ?? 0) > s.scrollPct[r.step_index]) s.scrollPct[r.step_index] = r.scroll_pct ?? 0;
    }
  }

  const sessions = [...map.values()].sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
  for (const s of sessions) {
    s.completed = s.maxStep >= LAST;
    // 마지막으로 보던 단계의 체류 = 전체 체류 − 앞 단계에 배분된 합
    const used = s.stepMs.reduce((a, b) => a + b, 0);
    const rest = s.dwellMs - used;
    if (rest > 0 && s.maxStep < DEMO_STEPS.length) s.stepMs[s.maxStep] += rest;
  }

  const actives = sessions.map((s) => s.activeMs);
  const summary = {
    visits: sessions.length,
    visitors: new Set(sessions.map((s) => s.visitorId)).size,
    repeatVisits: sessions.filter((s) => s.visitNo > 1).length,
    completed: sessions.filter((s) => s.completed).length,
    consult: sessions.filter((s) => s.consult).length,
    bounce: sessions.filter((s) => s.maxStep === 0).length,
    avgActiveMs: sessions.length ? Math.round(actives.reduce((a, b) => a + b, 0) / sessions.length) : 0,
    medActiveMs: median(actives),
    avgMaxStep: sessions.length
      ? Math.round((sessions.reduce((a, s) => a + s.maxStep + 1, 0) / sessions.length) * 10) / 10
      : 0,
  };

  const funnel = DEMO_STEPS.map((st, i) => {
    const reached = sessions.filter((s) => s.maxStep >= i);
    const times = reached.map((s) => s.stepMs[i]).filter((m) => m > 0);
    return {
      index: i,
      label: st.label,
      reached: reached.length,
      leftHere: sessions.filter((s) => s.maxStep === i).length,
      avgMs: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0,
    };
  });

  const tally = (pick: (s: DemoSession) => string) => {
    const m = new Map<string, number>();
    for (const s of sessions) {
      const k = pick(s);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n);
  };

  const devices = tally((s) => [s.device ?? "?", s.os ?? ""].filter(Boolean).join(" · "));
  const sources = tally((s) => {
    if (s.inapp) return `${s.inapp} 인앱`;
    if (!s.referrer) return "링크 직접 열기";
    try {
      return new URL(s.referrer).hostname;
    } catch {
      return s.referrer.slice(0, 40);
    }
  });

  return { steps: DEMO_STEPS, sessions, summary, funnel, devices, sources };
}

export async function loadDemoLinks(): Promise<DemoLink[]> {
  const { data, error } = await getServiceClient()
    .from("demo_links")
    .select("code,label,who_type,grade,channel,contact,memo,created_at,created_by")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as DemoLink[];
}
