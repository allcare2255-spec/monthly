import "server-only";
import { getServiceClient } from "@/lib/supabase";
import type { ReviewStatus } from "./store";
import { isRetryAttempt } from "./format";

/** 관리자 '복습 테스트' 현황 한 줄 */
export interface ReviewOverviewRow {
  id: string;
  code: string;
  /** 날짜를 뺀 제목 (과목_단원) */
  unit: string;
  subject: string | null;
  studentName: string | null;
  mentorName: string | null;
  /** 출제일 YYYY-MM-DD (제목 끝 (11/26) 기준, 없으면 만든 날) */
  issueDate: string;
  questionCount: number;
  status: ReviewStatus;
  /** 처음부터 푼 횟수 / 오답만 다시 푼 횟수 */
  fullCount: number;
  retryCount: number;
  /** 처음부터 푼 응시 기준 첫 점수, 가장 최근 점수 */
  firstScore: number | null;
  lastScore: number | null;
  /** 가장 최근 응시(오답 다시 풀기 포함) */
  lastAt: string | null;
  lastDurationSec: number | null;
  lastWasRetry: boolean;
}

const DATE_TAIL = /\s*\((\d{1,2})\/(\d{1,2})\)\s*$/;

/** 한국 시간 기준 YYYY-MM-DD */
function kstDate(iso: string): string {
  return new Date(new Date(iso).getTime() + 9 * 3600e3).toISOString().slice(0, 10);
}

/** 제목 끝 (M/D) 를 출제일로. 해가 바뀌는 경우(1월에 만든 12/30 문제)는 전년도로 본다. */
function issueDateOf(title: string, createdAt: string): string {
  const created = kstDate(createdAt);
  const m = DATE_TAIL.exec(title);
  if (!m) return created;
  let year = Number(created.slice(0, 4));
  const createdMonth = Number(created.slice(5, 7));
  const month = Number(m[1]);
  if (month > createdMonth + 1) year -= 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(Number(m[2])).padStart(2, "0")}`;
}

export async function listReviewOverview(): Promise<ReviewOverviewRow[]> {
  const sb = getServiceClient();
  const { data: sets, error } = await sb
    .from("review_sets")
    .select("id, code, title, subject, created_at, questions, student_id, student:coaching_students(name), mentor:coaching_mentors(name)")
    .not("student_id", "is", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const ids = (sets || []).map((s: any) => s.id as string);
  if (ids.length === 0) return [];

  // 링크 공유 시각 (칸이 없는 DB면 무시)
  const shared = await sb.from("review_sets").select("id, shared_at").in("id", ids);
  const sharedIds = new Set(shared.error ? [] : (shared.data || []).filter((r: any) => r.shared_at).map((r: any) => r.id));

  // 응시 기록 (풀이 시간 칸이 없는 DB면 시간 없이 다시 조회)
  let att = await sb
    .from("review_attempts")
    .select("review_set_id, title, score_percent, completed_at, duration_sec")
    .in("review_set_id", ids)
    .order("completed_at", { ascending: true });
  if (att.error && /duration_sec/.test(att.error.message)) {
    att = (await sb
      .from("review_attempts")
      .select("review_set_id, title, score_percent, completed_at")
      .in("review_set_id", ids)
      .order("completed_at", { ascending: true })) as typeof att;
  }
  if (att.error) throw new Error(att.error.message);
  const bySet = new Map<string, any[]>();
  for (const a of att.data || []) {
    const list = bySet.get(a.review_set_id) ?? [];
    list.push(a);
    bySet.set(a.review_set_id, list);
  }

  return (sets || []).map((s: any) => {
    const list = bySet.get(s.id) ?? [];
    const full = list.filter((a) => !isRetryAttempt(a.title));
    const last = list[list.length - 1];
    return {
      id: s.id,
      code: s.code,
      unit: (s.title as string).replace(DATE_TAIL, "").trim(),
      subject: s.subject ?? null,
      studentName: s.student?.name ?? null,
      mentorName: s.mentor?.name ?? null,
      issueDate: issueDateOf(s.title, s.created_at),
      questionCount: Array.isArray(s.questions) ? s.questions.length : 0,
      status: list.length > 0 ? "진행 완료" : sharedIds.has(s.id) ? "문제 풀이 중" : "링크 공유 전",
      fullCount: full.length,
      retryCount: list.length - full.length,
      firstScore: full[0]?.score_percent ?? null,
      lastScore: full[full.length - 1]?.score_percent ?? null,
      lastAt: last?.completed_at ?? null,
      lastDurationSec: last?.duration_sec ?? null,
      lastWasRetry: last ? isRetryAttempt(last.title) : false,
    } satisfies ReviewOverviewRow;
  });
}
