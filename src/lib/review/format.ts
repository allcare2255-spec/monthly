/** 풀이 시간(초)을 "12분 30초" 처럼. 없으면 null. */
export function fmtDuration(sec: number | null | undefined): string | null {
  if (sec == null || !Number.isFinite(sec) || sec < 0) return null;
  const s = Math.round(sec);
  if (s < 60) return `${s}초`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
  return r > 0 ? `${m}분 ${r}초` : `${m}분`;
}

/** 오답만 다시 푼 응시인지 (제목 끝 표시로 구분) */
export const isRetryAttempt = (title: string | null | undefined) => !!title && title.endsWith("(오답 다시 풀기)");
