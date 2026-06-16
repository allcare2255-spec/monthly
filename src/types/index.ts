export type Mentor = {
  id: string;
  name: string;
  mentor_code: string;
  created_at: string;
};

export type Student = {
  id: string;
  name: string;
  age: number | null;
  grade: string | null;
  phone: string | null;
  parent_phone: string | null;
  high_school: string | null;
  mentor_id: string | null;
  coaching_start_date: string | null;
  coaching_ended: boolean;
  consulting_token: string | null;   // 학생 컨설팅 폼 공개 링크 토큰 (/c/[token])
  created_at: string;
  updated_at: string;
};

// ── 컨설팅 폼 제출 ───────────────────────────────────────────
export type ConsultingFormType = "weekly" | "monthly" | "pre";

/** 업로드된 이미지 1장 (file_paths JSON에 저장). */
export type ConsultingFile = {
  url: string;   // public URL
  path: string;  // storage object path
};

export type ConsultingSubmission = {
  id: string;
  student_id: string;
  week_number: number;
  form_type: ConsultingFormType;
  submitted_at: string;
  answers: Record<string, string>;            // { 장문 질문키: 답변 }
  file_paths: Record<string, ConsultingFile[]>; // { 이미지 질문키: [업로드들] }
  agreements: Record<string, boolean>;         // { 동의항목키: true }
  memo: string | null;
};

export type CoachingCycle = {
  id: string;
  student_id: string;
  cycle_number: number;
  start_date: string | null;
  end_date: string | null;
  memo: string | null;
  created_at: string;
  updated_at: string;
};

export type DayStatus = "submitted" | "missed" | "paused";

export type DayPhoto = {
  url: string;   // public URL
  path: string;  // storage object path (삭제용)
};

export type DayData = {
  date: string;                  // "2026-05-27"
  wake_up_time: string | null;   // "06:30"
  wake_cert_off?: boolean;       // [수정 4] 기상 인증 X (시간 입력 비활성 토글)
  study_minutes: number | null;
  memo: string | null;
  status: DayStatus;
  photos?: DayPhoto[];           // [수정 5] 일별 공부 인증 사진 (최대 4장/일)
};

export type WeeklyReport = {
  id: string;
  student_id: string;
  cycle_number: number;
  week_number: number;           // 1~4
  start_date: string;
  end_date: string;
  day_data: DayData[];           // 7개
  good_points: string | null;
  improvement_points: string | null;
  next_week_actions: string | null;
  created_at: string;
  updated_at: string;
};

export type MonthlyReport = {
  id: string;
  student_id: string;
  cycle_number: number;
  month_summary: string | null;
  next_month_direction: string | null;
  created_at: string;
  updated_at: string;
};

// [수정 3] 주간 계획표
export type PlanTask = { id: string; text: string; done: boolean };

export type PlanDay = {
  notes: string;
  tasks: PlanTask[];
};

export type WeekdayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type WeeklyPlanData = {
  weekly_goals: PlanTask[];
  main_test: string[];
  days: Record<WeekdayKey, PlanDay>;
  summary: { achievement: string; feedback: string };
};

export type WeeklyPlan = {
  id: string;
  student_id: string;
  cycle_number: number;
  week_number: number;
  plan_data: WeeklyPlanData;
  created_at: string;
  updated_at: string;
};

export type Session = {
  role: "admin" | "mentor";
  mentorId?: string;
  mentorName?: string;
};

// ── 복습(Review) 기능 ───────────────────────────────────────────
export type QuestionType = "multiple_choice" | "ox" | "short_answer" | "essay";

export interface ReviewQuestion {
  type: QuestionType;
  question: string;
  /** 객관식 보기. OX는 ["O","X"], 단답/서술형은 빈 배열. */
  options: string[];
  /** 정답. 객관식=정답 보기 텍스트, OX="O"/"X", 단답=대표 정답, 서술형=모범답안. */
  answer: string;
  /** 단답형에서 정답으로 인정할 다른 표현들. */
  acceptedAnswers: string[];
  /** 해설 (오답 시 학생에게 보여줌). */
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
  /** 멘토 비공개 메모 (문제별). 학생에게 노출 금지. */
  mentorNote?: string;
}

export interface ReviewQuiz {
  title: string;
  questions: ReviewQuestion[];
  /** 멘토 비공개 메모 (테스트 전체). 학생에게 노출 금지. */
  mentorNote?: string;
}

/** 저장된 복습 세트(DB review_sets). */
export interface ReviewSet extends ReviewQuiz {
  id: string;
  code: string;
  mentorId?: string | null;
  studentId?: string | null;
  subject?: string | null;
  createdAt: string;
}

/** 학생에게 내려보내는, 정답이 제거된 문제. */
export interface PublicReviewQuestion {
  type: QuestionType;
  question: string;
  options: string[];
  difficulty: ReviewQuestion["difficulty"];
}

export interface PublicReviewQuiz {
  code: string;
  title: string;
  questions: PublicReviewQuestion[];
}

/** 채점 결과 (문제별). */
export interface GradedItem {
  index: number;
  type: QuestionType;
  question: string;
  studentAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  /** 서술형 등 부분점수 (0~1). */
  score: number;
  explanation: string;
  feedback: string;
}

export interface GradeResult {
  total: number;
  correct: number;
  scorePercent: number;
  items: GradedItem[];
}

/** 응시 기록(DB review_attempts) 요약 — 멘토 조회용. */
export interface ReviewAttempt {
  id: string;
  review_set_id: string;
  student_id: string | null;
  student_name: string | null;
  subject: string | null;
  title: string | null;
  score_percent: number;
  total: number;
  correct: number;
  result: GradedItem[];
  completed_at: string;
}
