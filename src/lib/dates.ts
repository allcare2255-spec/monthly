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
