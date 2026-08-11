import "server-only";
import crypto from "crypto";
import { getServiceClient } from "@/lib/supabase";
import { isEmptyNoteHtml } from "@/lib/consulting/note-html";
import type { ConsultingSubmission, ConsultingFormType, ConsultingFile, ConsultingNote } from "@/types";

const SUB_COLS_BASE =
  "id, student_id, week_number, form_type, submitted_at, answers, file_paths, agreements, memo";
const SUB_COLS = `${SUB_COLS_BASE}, deleted_at, deleted_by`;

/** 컨설팅 제출물 이미지가 올라가는 버킷 (영구삭제 시 함께 정리). */
const PHOTO_BUCKET = "coaching-photos";

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
    .select(SUB_COLS_BASE)
    .single();
  if (error) throw new Error(error.message);
  return data as ConsultingSubmission;
}

// ── 제출 내역 조회 / 휴지통 ─────────────────────────────────────
/** active = 살아있는 것만, trash = 휴지통만, all = 전부. */
export type SubmissionScope = "active" | "trash" | "all";

/** 마이그레이션(20260810_consulting_submission_trash.sql) 미적용 여부 판별 */
function isMissingTrashColumn(msg: string): boolean {
  return /deleted_at|deleted_by/.test(msg) && /column|does not exist/i.test(msg);
}

export class TrashNotReadyError extends Error {
  constructor() {
    super("휴지통 기능은 20260810_consulting_submission_trash.sql 적용 후 사용할 수 있습니다.");
    this.name = "TrashNotReadyError";
  }
}

/**
 * 휴지통 컬럼 적용 여부 캐시.
 * null = 아직 모름 / true = 적용됨 / false = 미적용(구 스키마로 폴백).
 */
let trashReady: boolean | null = null;

type SubQuery = {
  studentId?: string;
  id?: string;
  weekNumber?: number;
  formType?: ConsultingFormType;
  scope: SubmissionScope;
  limit?: number;
};

/**
 * 제출 내역 조회 단일 진입점.
 * 마이그레이션이 아직 안 걸린 DB에서도 페이지가 죽지 않도록, deleted_at 컬럼이 없으면
 * 구 스키마(휴지통 없음)로 한 번 더 조회한다.
 */
async function querySubmissions(opts: SubQuery): Promise<ConsultingSubmission[]> {
  const supabase = getServiceClient();
  const build = (cols: string, scope: SubmissionScope) => {
    let q = supabase.from("consulting_submissions").select(cols);
    if (opts.id) q = q.eq("id", opts.id);
    if (opts.studentId) q = q.eq("student_id", opts.studentId);
    if (opts.weekNumber !== undefined) q = q.eq("week_number", opts.weekNumber);
    if (opts.formType) q = q.eq("form_type", opts.formType);
    if (scope === "active") q = q.is("deleted_at", null);
    else if (scope === "trash") q = q.not("deleted_at", "is", null);
    q = q.order("submitted_at", { ascending: false });
    if (opts.limit) q = q.limit(opts.limit);
    return q;
  };

  if (trashReady !== false) {
    const { data, error } = await build(SUB_COLS, opts.scope);
    if (!error) {
      trashReady = true;
      return (data || []) as unknown as ConsultingSubmission[];
    }
    if (!isMissingTrashColumn(error.message)) throw new Error(error.message);
    trashReady = false;
  }

  // 구 스키마 — 삭제 개념이 없으므로 휴지통은 항상 빈 목록
  if (opts.scope === "trash") return [];
  const { data, error } = await build(SUB_COLS_BASE, "all");
  if (error) throw new Error(error.message);
  return (data || []) as unknown as ConsultingSubmission[];
}

/** 특정 누적 주차 + 폼 종류에 해당하는 제출 1건 (최신, 레포트 참고용). */
export async function getSubmissionByWeek(
  studentId: string,
  weekNumber: number,
  formType: ConsultingFormType,
): Promise<ConsultingSubmission | null> {
  const rows = await querySubmissions({ studentId, weekNumber, formType, scope: "active", limit: 1 });
  return rows[0] ?? null;
}

/** 학생의 제출 내역 (최신순). 기본은 휴지통 제외. */
export async function listSubmissionsByStudent(
  studentId: string,
  scope: SubmissionScope = "active",
): Promise<ConsultingSubmission[]> {
  return querySubmissions({ studentId, scope });
}

/** 학생의 휴지통 목록 (삭제된 것만, 최신순). */
export async function listTrashedSubmissions(studentId: string): Promise<ConsultingSubmission[]> {
  return querySubmissions({ studentId, scope: "trash" });
}

/** 제출물 1건 (휴지통 포함) — 권한 확인용. */
export async function getSubmissionById(id: string): Promise<ConsultingSubmission | null> {
  const rows = await querySubmissions({ id, scope: "all", limit: 1 });
  return rows[0] ?? null;
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
  const rows = await querySubmissions({ studentId, weekNumber, scope: "active", limit: 1 });
  return rows[0] ?? null;
}

/**
 * 휴지통으로 보내기 / 되돌리기 (소프트 삭제).
 * 실제 행과 이미지는 그대로 두고 deleted_at 만 찍는다 → 언제든 복원 가능.
 */
export async function setSubmissionDeleted(
  id: string,
  deleted: boolean,
  actorName: string | null,
): Promise<ConsultingSubmission> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("consulting_submissions")
    .update(
      deleted
        ? { deleted_at: new Date().toISOString(), deleted_by: actorName }
        : { deleted_at: null, deleted_by: null },
    )
    .eq("id", id)
    .select(SUB_COLS)
    .single();
  if (error) {
    if (isMissingTrashColumn(error.message)) {
      trashReady = false;
      throw new TrashNotReadyError();
    }
    throw new Error(error.message);
  }
  return data as unknown as ConsultingSubmission;
}

/**
 * 영구삭제 — 업로드된 이미지까지 스토리지에서 지우고 행을 제거한다. 복원 불가.
 * (스토리지 삭제가 실패해도 행 삭제는 진행 — 고아 파일이 남는 편이 낫다)
 */
export async function purgeSubmission(id: string): Promise<void> {
  const supabase = getServiceClient();
  const sub = await getSubmissionById(id);
  if (!sub) return;

  const paths = Object.values(sub.file_paths || {})
    .flat()
    .map((f) => f?.path)
    .filter((p): p is string => Boolean(p));
  if (paths.length) {
    await supabase.storage.from(PHOTO_BUCKET).remove(paths);
  }

  const { error } = await supabase.from("consulting_submissions").delete().eq("id", id);
  if (error) throw new Error(error.message);
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

// ── 주차 이동 ───────────────────────────────────────────────────
/**
 * 한 주차의 컨설팅 내용을 다른 주차로 옮긴다 (학생 제출 폼 / 멘토 메모 각각 선택).
 *
 * 학생이 폼을 늦게 내거나 링크를 잘못 눌러 주차가 어긋나는 일이 있어, 멘토/관리자가
 * 화면에서 직접 바로잡을 수 있게 한다.
 *
 * 안전 규칙 — 옮길 곳에 이미 내용이 있으면 아무것도 하지 않고 막는다.
 * 덮어쓰기로 남의 기록이 소리 없이 사라지는 것보다, 실패하고 안내하는 편이 낫다.
 */
export class MoveWeekConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoveWeekConflictError";
  }
}

export async function moveConsultingWeek(input: {
  studentId: string;
  fromWeek: number;
  toWeek: number;
  moveSubmission: boolean;
  moveNote: boolean;
  actorName?: string | null;
}): Promise<{ movedSubmission: boolean; movedNote: boolean }> {
  const { studentId, fromWeek, toWeek } = input;
  if (fromWeek === toWeek) throw new MoveWeekConflictError("같은 주차로는 옮길 수 없습니다.");
  if (!input.moveSubmission && !input.moveNote) {
    throw new MoveWeekConflictError("옮길 항목을 하나 이상 선택해주세요.");
  }

  const [fromSub, toSub, fromNote, toNote] = await Promise.all([
    input.moveSubmission ? getSubmissionByWeekAnyForm(studentId, fromWeek) : null,
    input.moveSubmission ? getSubmissionByWeekAnyForm(studentId, toWeek) : null,
    input.moveNote ? getNoteByWeek(studentId, fromWeek) : null,
    input.moveNote ? getNoteByWeek(studentId, toWeek) : null,
  ]);

  // 먼저 전부 검사한 뒤에 쓴다 — 하나만 옮겨지고 다른 하나가 실패하는 상태를 막는다
  if (input.moveSubmission) {
    if (!fromSub) throw new MoveWeekConflictError(`${fromWeek}주차에 옮길 학생 제출 폼이 없습니다.`);
    if (toSub) throw new MoveWeekConflictError(`${toWeek}주차에 이미 학생 제출 폼이 있습니다.`);
  }
  const fromNoteText = (fromNote?.note ?? "").trim();
  if (input.moveNote) {
    if (!fromNoteText) throw new MoveWeekConflictError(`${fromWeek}주차에 옮길 컨설팅 내용 정리가 없습니다.`);
    if (!isEmptyNoteHtml(toNote?.note ?? "")) {
      throw new MoveWeekConflictError(`${toWeek}주차에 이미 컨설팅 내용 정리가 있습니다.`);
    }
  }

  const supabase = getServiceClient();
  if (input.moveSubmission && fromSub) {
    const { error } = await supabase
      .from("consulting_submissions")
      .update({ week_number: toWeek })
      .eq("id", fromSub.id);
    if (error) throw new Error(error.message);
  }
  if (input.moveNote && fromNote) {
    // 행을 옮기지 않고 내용을 복사한 뒤 원래 주차를 비운다.
    // (consulting_notes 는 student_id+week_number 가 unique 라, 옮길 곳에 빈 메모 행만
    //  남아 있어도 week_number 만 바꾸는 방식은 충돌한다)
    const author = fromNote.author_name ?? input.actorName ?? null;
    await upsertNote({ studentId, weekNumber: toWeek, note: fromNote.note, authorName: author });
    await upsertNote({ studentId, weekNumber: fromWeek, note: "", authorName: author });
  }

  return { movedSubmission: input.moveSubmission, movedNote: input.moveNote };
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
