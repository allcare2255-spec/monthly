// 코칭 시작일(월요일)부터 cycle/week 기반 날짜 계산

export function addDays(yyyymmdd: string, days: number): string {
  const [y, m, d] = yyyymmdd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/**
 * 주어진 날짜(yyyy-mm-dd)를 월요일로 보정한다. 코칭은 항상 월요일에 시작한다.
 * - 월요일: 그대로
 * - 화~토: 그 주의 월요일(직전 월요일)
 * - 일요일: 다음 날 월요일(코칭 주가 곧 시작한다고 보는 게 자연스러움)
 * 예) 2026-06-09(화)→2026-06-08(월), 2026-06-07(일)→2026-06-08(월).
 * 형식이 잘못되면 입력을 그대로 돌려준다.
 */
export function mondayOf(yyyymmdd: string): string {
  const parts = yyyymmdd.split("-").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return yyyymmdd;
  const [y, m, d] = parts;
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay(); // 0=일, 1=월, … 6=토
  // 일요일(0)은 +1 → 다음 날 월요일, 그 외는 직전 월요일까지 되돌림
  const shift = dow === 0 ? 1 : -(dow - 1);
  dt.setUTCDate(dt.getUTCDate() + shift);
  return dt.toISOString().slice(0, 10);
}

export function weekRange(start: string, week: number) {
  // week: 1~4
  const startOfWeek = addDays(start, (week - 1) * 7);
  const endOfWeek = addDays(startOfWeek, 6);
  return { start: startOfWeek, end: endOfWeek };
}

export function listDates(start: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}

/**
 * 코칭 시작 이후 누적 주차 (cycle 1, week 1 -> 1주차; cycle 2, week 1 -> 5주차)
 */
export function cumulativeWeek(cycle: number, week: number): number {
  return (cycle - 1) * 4 + week;
}

/**
 * [변경 3] 재시작 앵커를 반영한 사이클 시작일 계산.
 * 기본 앵커는 cycle 1 = coachingStart. 추가 앵커(재시작)는 해당 cycle부터 새 기준일.
 * 주어진 cycle 이하의 가장 큰 앵커를 골라 (cycle - 앵커cycle)*28 만큼 더한다.
 */
export type CycleAnchor = { cycle: number; start_date: string };

export function resolveCycleStart(
  coachingStart: string,
  cycle: number,
  anchors: CycleAnchor[] = [],
): string {
  const all: CycleAnchor[] = [{ cycle: 1, start_date: coachingStart }, ...anchors]
    .filter((a) => !!a.start_date)
    .sort((a, b) => a.cycle - b.cycle);
  let chosen = all[0];
  for (const a of all) {
    if (a.cycle <= cycle) chosen = a;
    else break;
  }
  return addDays(chosen.start_date, (cycle - chosen.cycle) * 28);
}

/**
 * 재시작 앵커 + 월차 시작일 오버라이드를 하나의 앵커 목록으로 합친다.
 *
 * 월차 시작일을 손으로 수정하면(예: 일주일 쉬고 시작) 그 월차뿐 아니라
 * "그 이후 월차들도 자동으로 이어져야" 하므로, 오버라이드도 재시작과 똑같이
 * 앵커로 취급한다. resolveCycleStart 가 대상 월차 이하의 가장 큰 앵커를 골라
 * 28일씩 더하므로, 이후 월차는 수정된 날짜에서 자연히 이어진다.
 *
 * 같은 월차에 재시작과 오버라이드가 둘 다 있으면 오버라이드(직접 수정한 값)를 우선한다.
 */
export function buildCycleAnchors(
  restarts?: { cycle_number: number; start_date: string | null }[] | null,
  cycleOverrides?: { cycle_number: number; start_date: string | null }[] | null,
): CycleAnchor[] {
  const byCycle = new Map<number, string>();
  for (const r of restarts || []) {
    if (r.start_date) byCycle.set(r.cycle_number, r.start_date);
  }
  for (const c of cycleOverrides || []) {
    if (c.start_date) byCycle.set(c.cycle_number, c.start_date);
  }
  return Array.from(byCycle, ([cycle, start_date]) => ({ cycle, start_date })).sort(
    (a, b) => a.cycle - b.cycle,
  );
}

/** 서버(UTC)에서도 한국시간(KST) 기준 오늘 날짜(yyyy-mm-dd). */
export function todaySeoul(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

/** 두 날짜(yyyy-mm-dd) 사이 일수 (b - a). */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

/**
 * 코칭 시작일부터 오늘까지 실제 날짜 기준 누적 주차.
 * 시작일이 속한 주(월~일)를 1주차로 하여 7일마다 +1. 시작 전이면 0.
 */
export function weeksSinceStart(start: string, today: string): number {
  const diff = daysBetween(start, today);
  if (diff < 0) return 0;
  return Math.floor(diff / 7) + 1;
}

// "10:23" 같은 시간 문자열 → 분
export function hmToMinutes(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = /^(\d{1,2}):(\d{1,2})$/.exec(s.trim());
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

export function minutesToHm(mins: number | null | undefined): string {
  if (mins == null) return "-";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}시간 ${m}분`;
}
