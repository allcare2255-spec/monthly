// 코칭 시작일(월요일)부터 cycle/week 기반 날짜 계산

export function addDays(yyyymmdd: string, days: number): string {
  const [y, m, d] = yyyymmdd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
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
