import "server-only";
import crypto from "crypto";
import { getServiceClient } from "@/lib/supabase";
import type { ConsultingSubmission, ConsultingFormType, ConsultingFile, ConsultingNote } from "@/types";

const SUB_COLS =
  "id, student_id, week_number, form_type, submitted_at, answers, file_paths, agreements, memo";

/** 추측 불가능한 공개 링크 토큰 (24자리 hex, URL-safe, 사람이 입력하지 않음). */
export function generateToken(): string {
  return crypto.randomBytes(12).toString("hex");
}

export type ConsultingStudent = {
  id: string;
  name: string;
  phone: string | null;
  mentorName: string | null;
  coachingStartDate: string | null;
};

/** 공개 토큰으로 학생을 조회한다 (prefill / 권한 확인용). */
export async function getStudentByToken(token: string): Promise<ConsultingStudent | undefined> {
  if (!token || !/^[a-f0-9]{8,}$/i.test(token)) return undefined;
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("coaching_students")
    .select("id, name, phone, coaching_start_date, mentor:coaching_mentors(name)")
    .eq("consulting_token", token)
    .maybeSingle<{
      id: string;
      name: string;
      phone: string | null;
      coaching_start_date: string | null;
      mentor: { name: string } | null;
    }>();
  if (error) throw new Error(error.message);
  if (!data) return undefined;
  return {
    id: data.id,
    name: data.name,
    phone: data.phone ?? null,
    mentorName: data.mentor?.name ?? null,
    coachingStartDate: data.coaching_start_date ?? null,
  };
}

/** 학생에게 토큰이 없으면 새로 발급한다 (기존 학생/멘토 페이지 링크 안전장치). */
export async function ensureToken(studentId: string): Promise<string> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("coaching_students")
    .select("consulting_token")
    .eq("id", studentId)
    .maybeSingle();
  if (data?.consulting_token) return data.consulting_token;
  for (let i = 0; i < 5; i++) {
    const token = generateToken();
    const { error } = await supabase
      .from("coaching_students")
      .update({ consulting_token: token })
      .eq("id", studentId);
    if (!error) return token;
    if ((error as { code?: string } | null)?.code !== "23505") throw new Error(error.message);
  }
  throw new Error("토큰 발급에 반복 실패했습니다.");
}

export type SaveSubmissionInput = {
  studentId: string;
  weekNumber: number;
  formType: ConsultingFormType;
  answers: Record<string, string>;
  filePaths: Record<string, ConsultingFile[]>;
  agreements: Record<string, boolean>;
  memo?: string | null;
};

export async function saveSubmission(input: SaveSubmissionInput): Promise<ConsultingSubmission> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("consulting_submissions")
    .insert({
      student_id: input.studentId,
      week_number: input.weekNumber,
      form_type: input.formType,
      answers: input.answers,
      file_paths: input.filePaths,
      agreements: input.agreements,
      memo: input.memo ?? null,
    })
    .select(SUB_COLS)
    .single();
  if (error) throw new Error(error.message);
  return data as ConsultingSubmission;
}

/** 특정 누적 주차 + 폼 종류에 해당하는 제출 1건 (최신, 레포트 참고용). */
export async function getSubmissionByWeek(
  studentId: string,
  weekNumber: number,
  formType: ConsultingFormType,
): Promise<ConsultingSubmission | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("consulting_submissions")
    .select(SUB_COLS)
    .eq("student_id", studentId)
    .eq("week_number", weekNumber)
    .eq("form_type", formType)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ConsultingSubmission) ?? null;
}

/** 학생의 제출 내역 (최신순). */
export async function listSubmissionsByStudent(studentId: string): Promise<ConsultingSubmission[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("consulting_submissions")
    .select(SUB_COLS)
    .eq("student_id", studentId)
    .order("submitted_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as ConsultingSubmission[];
}

/**
 * 특정 누적 주차의 제출물 (폼 종류 무관, 최신 1건).
 * 학생이 ?form=pre 같은 직접 링크로 제출하면 주차와 폼 종류가 어긋날 수 있어,
 * 컨설팅 화면에서는 주차만으로 조회한다.
 */
export async function getSubmissionByWeekAnyForm(
  studentId: string,
  weekNumber: number,
): Promise<ConsultingSubmission | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("consulting_submissions")
    .select(SUB_COLS)
    .eq("student_id", studentId)
    .eq("week_number", weekNumber)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ConsultingSubmission) ?? null;
}

// ── 멘토 컨설팅 메모 ────────────────────────────────────────────
const NOTE_COLS = "id, student_id, week_number, note, author_name, created_at, updated_at";

/** 특정 주차의 멘토 메모 1건 (없으면 null). */
export async function getNoteByWeek(
  studentId: string,
  weekNumber: number,
): Promise<ConsultingNote | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("consulting_notes")
    .select(NOTE_COLS)
    .eq("student_id", studentId)
    .eq("week_number", weekNumber)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ConsultingNote) ?? null;
}

/** 학생의 메모가 존재하는 주차 목록 (버튼에 ● 표시용). */
export async function listNoteWeeks(studentId: string): Promise<number[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("consulting_notes")
    .select("week_number, note")
    .eq("student_id", studentId);
  if (error) throw new Error(error.message);
  return (data || [])
    .filter((r: { note: string | null }) => (r.note || "").trim().length > 0)
    .map((r: { week_number: number }) => r.week_number);
}

/** 메모 저장 (학생+주차 단위 upsert). */
export async function upsertNote(input: {
  studentId: string;
  weekNumber: number;
  note: string;
  authorName?: string | null;
}): Promise<ConsultingNote> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("consulting_notes")
    .upsert(
      {
        student_id: input.studentId,
        week_number: input.weekNumber,
        note: input.note,
        author_name: input.authorName ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "student_id,week_number" },
    )
    .select(NOTE_COLS)
    .single();
  if (error) throw new Error(error.message);
  return data as ConsultingNote;
}

// ── 컨설팅 기록 공개 링크 ───────────────────────────────────────
export type NoteShare = { token: string | null; enabled: boolean };

/** 마이그레이션(20260806_consulting_note_share.sql) 미적용 여부 판별 */
function isMissingShareColumn(msg: string): boolean {
  return /share_token|share_enabled/.test(msg) && /column|does not exist/i.test(msg);
}

export class ShareNotReadyError extends Error {
  constructor() {
    super("공개 링크 기능은 20260806_consulting_note_share.sql 적용 후 사용할 수 있습니다.");
    this.name = "ShareNotReadyError";
  }
}

/** 특정 주차 메모의 공유 상태 (행이 없으면 아직 만든 적 없음). */
export async function getNoteShare(
  studentId: string,
  weekNumber: number,
): Promise<NoteShare> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("consulting_notes")
    .select("share_token, share_enabled")
    .eq("student_id", studentId)
    .eq("week_number", weekNumber)
    .maybeSingle();
  if (error) {
    if (isMissingShareColumn(error.message)) throw new ShareNotReadyError();
    throw new Error(error.message);
  }
  return {
    token: (data as { share_token?: string | null } | null)?.share_token ?? null,
    enabled: Boolean((data as { share_enabled?: boolean } | null)?.share_enabled),
  };
}

/**
 * 공유 상태 변경.
 *  - enable    : 토큰이 없으면 발급하고 켠다
 *  - disable   : 토큰은 남겨두고 끈다 (다시 켜면 같은 주소가 살아난다)
 *  - regenerate: 새 토큰으로 바꾼다 (= 기존 링크 무효화) 후 켠다
 */
export async function setNoteShare(
  studentId: string,
  weekNumber: number,
  action: "enable" | "disable" | "regenerate",
): Promise<NoteShare> {
  const supabase = getServiceClient();
  const current = await getNoteShare(studentId, weekNumber);

  let token = current.token;
  let enabled = current.enabled;
  if (action === "disable") {
    enabled = false;
  } else {
    if (action === "regenerate" || !token) token = generateToken();
    enabled = true;
  }

  // 메모 행이 아직 없을 수도 있으므로 upsert 로 만든다 (note 는 건드리지 않는다)
  const { error } = await supabase
    .from("consulting_notes")
    .upsert(
      {
        student_id: studentId,
        week_number: weekNumber,
        share_token: token,
        share_enabled: enabled,
      },
      { onConflict: "student_id,week_number" },
    );
  if (error) {
    if (isMissingShareColumn(error.message)) throw new ShareNotReadyError();
    throw new Error(error.message);
  }
  return { token, enabled };
}

/** 공개 토큰으로 열람 대상(학생+주차)을 찾는다. 꺼져 있으면 null. */
export async function getSharedNoteByToken(
  token: string,
): Promise<{ studentId: string; weekNumber: number; note: string } | null> {
  if (!token || !/^[a-f0-9]{8,}$/i.test(token)) return null;
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("consulting_notes")
    .select("student_id, week_number, note, share_enabled")
    .eq("share_token", token)
    .maybeSingle();
  if (error) {
    if (isMissingShareColumn(error.message)) return null;
    throw new Error(error.message);
  }
  const row = data as
    | { student_id: string; week_number: number; note: string | null; share_enabled: boolean }
    | null;
  if (!row || !row.share_enabled) return null;
  return { studentId: row.student_id, weekNumber: row.week_number, note: row.note ?? "" };
}
