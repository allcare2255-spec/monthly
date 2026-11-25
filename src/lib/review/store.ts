import "server-only";
import crypto from "crypto";
import { getServiceClient } from "@/lib/supabase";
import type {
  ReviewQuiz,
  ReviewSet,
  ReviewQuestion,
  PublicReviewQuiz,
  GradeResult,
  ReviewAttempt,
} from "@/types";
import { toPublicParts } from "./cloze";

const SET_COLS =
  "id, code, mentor_id, student_id, subject, title, questions, mentor_note, created_at";

/** 사람이 입력하기 쉬운 6자리 코드 (혼동되는 글자 제외). */
function generateCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // I,O,L,0,1 제외
  let code = "";
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) code += alphabet[bytes[i] % alphabet.length];
  return code;
}

function rowToReviewSet(row: any): ReviewSet {
  return {
    id: row.id,
    code: row.code,
    mentorId: row.mentor_id ?? null,
    studentId: row.student_id ?? null,
    subject: row.subject ?? null,
    title: row.title,
    questions: row.questions as ReviewQuestion[],
    mentorNote: row.mentor_note ?? undefined,
    createdAt: row.created_at,
  };
}

/** 복습 세트를 저장하고 코드를 발급한다. */
export async function saveReviewSet(
  quiz: ReviewQuiz,
  opts: { mentorId?: string | null; studentId?: string | null; subject?: string | null }
): Promise<ReviewSet> {
  const supabase = getServiceClient();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const { data, error } = await supabase
      .from("review_sets")
      .insert({
        code,
        mentor_id: opts.mentorId ?? null,
        student_id: opts.studentId ?? null,
        subject: opts.subject ?? null,
        title: quiz.title,
        questions: quiz.questions,
        mentor_note: quiz.mentorNote ?? null,
      })
      .select(SET_COLS)
      .single();

    if (!error && data) return rowToReviewSet(data);
    if ((error as any)?.code === "23505") continue; // 코드 중복 → 재시도
    throw new Error(error?.message || "복습 세트 저장에 실패했습니다.");
  }
  throw new Error("코드 생성에 반복 실패했습니다. 다시 시도해 주세요.");
}

export async function getReviewSetByCode(code: string): Promise<ReviewSet | undefined> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("review_sets")
    .select(SET_COLS)
    .eq("code", code.toUpperCase())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToReviewSet(data) : undefined;
}

export async function getReviewSetById(id: string): Promise<ReviewSet | undefined> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("review_sets")
    .select(SET_COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToReviewSet(data) : undefined;
}

/** 복습 테스트 진행상황 */
export type ReviewStatus = "링크 공유 전" | "문제 풀이 중" | "진행 완료";

/**
 * 목록에 진행상황을 붙인다.
 * - 학생이 한 번이라도 제출(review_attempts) → 진행 완료
 * - 멘토가 링크 복사를 누름(shared_at) → 문제 풀이 중
 * - 그 외 → 링크 공유 전
 * shared_at 칸이 아직 없는 DB(마이그레이션 전)에서도 깨지지 않게 실패는 무시한다.
 */
async function attachStatus<T extends { id: string }>(rows: T[]): Promise<(T & { status: ReviewStatus })[]> {
  if (rows.length === 0) return [];
  const supabase = getServiceClient();
  const ids = rows.map((r) => r.id);
  const [shared, attempts] = await Promise.all([
    supabase.from("review_sets").select("id, shared_at").in("id", ids),
    supabase.from("review_attempts").select("review_set_id").in("review_set_id", ids),
  ]);
  const sharedIds = new Set(
    shared.error ? [] : (shared.data || []).filter((r: any) => r.shared_at).map((r: any) => r.id as string)
  );
  const doneIds = new Set((attempts.data || []).map((r: any) => r.review_set_id as string));
  return rows.map((r) => ({
    ...r,
    status: doneIds.has(r.id) ? "진행 완료" : sharedIds.has(r.id) ? "문제 풀이 중" : "링크 공유 전",
  }));
}

/** 링크 복사 시 공유 시각 기록 (처음 한 번만). 칸이 없으면 false. */
export async function markReviewSetShared(id: string): Promise<boolean> {
  const { error } = await getServiceClient()
    .from("review_sets")
    .update({ shared_at: new Date().toISOString() })
    .eq("id", id)
    .is("shared_at", null);
  if (error) {
    console.error("[복습] 공유 시각 기록 실패:", error.message);
    return false;
  }
  return true;
}

/** 멘토가 출제한 세트 목록(문항 제외 요약). */
export async function listReviewSetsByMentor(mentorId: string) {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("review_sets")
    .select("id, code, title, subject, student_id, created_at, student:coaching_students(name)")
    .eq("mentor_id", mentorId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return attachStatus((data || []) as any[]);
}

/** 특정 학생에게 연결된 세트 목록. */
export async function listReviewSetsByStudent(studentId: string) {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("review_sets")
    .select("id, code, title, subject, created_at")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return attachStatus((data || []) as any[]);
}

/** 세트의 응시 기록 목록. */
export async function listAttemptsBySet(setId: string): Promise<ReviewAttempt[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("review_attempts")
    .select("*")
    .eq("review_set_id", setId)
    .order("completed_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as ReviewAttempt[];
}

/** 세트에 연결된 학생 이름 (이름 칸 미리 채우기용). 실패해도 null. */
export async function getStudentNameForSet(set: ReviewSet): Promise<string | null> {
  if (!set.studentId) return null;
  try {
    const { data } = await getServiceClient()
      .from("coaching_students")
      .select("name")
      .eq("id", set.studentId)
      .maybeSingle();
    return (data?.name as string | undefined) ?? null;
  } catch {
    return null;
  }
}

/** 정답을 제거한, 학생에게 안전하게 내려보낼 버전. */
export function toPublicReviewQuiz(set: ReviewSet, studentName?: string | null): PublicReviewQuiz {
  return {
    code: set.code,
    title: set.title,
    subject: set.subject ?? null,
    studentName: studentName ?? null,
    questions: set.questions.map((q) => ({
      type: q.type,
      question: q.question,
      options: q.options ?? [],
      difficulty: q.difficulty,
      tag: q.tag,
      context: q.context,
      table: q.table,
      body: q.body,
      parts: toPublicParts(q.parts),
    })),
  };
}

/** 학생의 1회 응시 결과를 review_attempts 에 저장. */
export async function saveAttempt(
  set: ReviewSet,
  studentName: string,
  result: GradeResult
): Promise<void> {
  const supabase = getServiceClient();
  const { error } = await supabase.from("review_attempts").insert({
    review_set_id: set.id,
    student_id: set.studentId ?? null,
    student_name: studentName.trim() || null,
    subject: set.subject ?? null,
    title: set.title,
    score_percent: result.scorePercent,
    total: result.total,
    correct: result.correct,
    result: result.items,
  });
  if (error) throw new Error(error.message);
}
