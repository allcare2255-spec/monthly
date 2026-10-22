// 컨설팅 폼 정의 — 공개 폼(렌더)과 멘토 prep 뷰(라벨 조회)가 공유한다.
// (server-only 아님: 클라이언트 컴포넌트에서도 import)
import type { ConsultingFormType } from "@/types";
import { todaySeoul } from "@/lib/dates";

export type ConsultingFieldType = "image" | "longtext" | "choice";

export type ConsultingField = {
  key: string;
  label: string;
  hint?: string;
  type: ConsultingFieldType;
  required: boolean;
  /** type === "choice" 일 때 고르는 보기 */
  choices?: string[];
  /** 특정 보기를 고르면 그 아래에 뜨는 안내문 — { 보기: 안내문 } */
  revealOn?: Record<string, string>;
};

/**
 * [기간 한정] 중간고사 결과 항목.
 *
 * 중간고사는 1년에 두 번뿐이라 주간/월간 폼에 상시로 두면 나머지 주차엔 계속 빈칸으로 뜬다.
 * 그래서 MIDTERM_WINDOW 기간 + 대상 학년(내신 치는 재학생)일 때만 학생 폼에 노출한다.
 * 기말고사 때 다시 받으려면 MIDTERM_WINDOW 날짜만 바꾸면 된다.
 *
 * 노출 판정은 '학생이 폼을 볼 때'만 적용하고(studentFormFields),
 * 제출 검증과 멘토 화면의 라벨 조회에는 항상 포함한다(fieldsFor).
 * 선택 항목이라 제출이 막히지 않고, 기간이 지난 뒤에도 받아둔 답이 라벨과 함께 보인다.
 */
export const MIDTERM_FIELD: ConsultingField = {
  key: "midterm_report_received",
  label: "중간고사 성적표를 받았나요?",
  type: "choice",
  choices: ["예", "아니오"],
  // 성적표 사진은 폼으로 받지 않고 단톡방으로 모은다 (업로드 칸 없음)
  revealOn: { 예: "단톡방에 꼭 성적표 올려주세요!" },
  required: false,
};

/**
 * 중간고사 결과를 받는 기간 (KST, 양끝 포함).
 * 10/17~18 컨설팅 주말부터, 결과를 보며 코칭하는 11월 말까지 열어둔다.
 */
export const MIDTERM_WINDOW = { from: "2026-10-13", to: "2026-11-30" } as const;

/** 내신 중간고사를 치는 재학생만 — N수생·재수생 폼에는 띄우지 않는다. */
export const MIDTERM_GRADES = ["고1", "고2"] as const;

/** 중간고사 식별자 — 저장 키의 앞부분. 기말고사를 받을 땐 이 값을 바꾼다. */
export const MIDTERM_EXAM_KEY = "2026-2-midterm";

/**
 * 중간고사 결과 저장 키 — 시험 + 누적 주차.
 *
 * 멘토 메모와 같이 '적은 그 주차에서만' 보이게 하기 위해 주차를 키에 넣는다.
 * (처음에는 시험 단위로만 저장해 모든 주차에 같은 내용이 떴다)
 */
export function midtermExamKey(cumWeek: number): string {
  return `${MIDTERM_EXAM_KEY}:w${cumWeek}`;
}

/** 화면에 띄울 시험 이름 */
export const MIDTERM_EXAM_LABEL = "2학기 중간고사";

/** 지금 이 학생 폼에 중간고사 결과 항목을 띄울지 */
export function showsMidterm(
  formType: ConsultingFormType,
  grade: string | null | undefined,
  today: string = todaySeoul(),
): boolean {
  if (formType === "pre") return false; // 사전 질문지엔 이미 성적 문항이 있다
  if (!grade || !(MIDTERM_GRADES as readonly string[]).includes(grade)) return false;
  return today >= MIDTERM_WINDOW.from && today <= MIDTERM_WINDOW.to;
}

// 주간 성장 코칭 폼 (weekly)
export const WEEKLY_FIELDS: ConsultingField[] = [
  { key: "screentime", label: "스크린타임 스크린샷", type: "image", required: false },
  { key: "miss_reason", label: "지난 주 계획을 못 지킨 이유가 있다면 간단히", type: "longtext", required: true },
  { key: "next_plan", label: "다음 주 계획을 적어서 찍어 보내기 (가능한 수준으로)", type: "image", required: false },
  { key: "worry_korean", label: "이번주 주요 국어 고민", hint: "구체적일수록 자세한 상담이 가능해요", type: "longtext", required: true },
  { key: "worry_math", label: "이번주 주요 수학 고민", type: "longtext", required: true },
  { key: "worry_english", label: "이번주 주요 영어 고민", type: "longtext", required: true },
  { key: "worry_explore", label: "이번주 주요 탐구 고민", type: "longtext", required: true },
  { key: "worry_extra", label: "이번주 추가적인 고민", type: "longtext", required: true },
  { key: "help_wanted", label: "멘토님께 이번주 특히 도움받고 싶은 부분", type: "longtext", required: true },
  { key: "memo", label: "메모", type: "longtext", required: false },
];

// 월간 비전 컨설팅 폼 (monthly)
export const MONTHLY_FIELDS: ConsultingField[] = [
  { key: "last_plan_photo", label: "지난 달 계획 사진 (완료된 걸 표시 후)", type: "image", required: false },
  { key: "achievement_review", label: "계획 달성도가 얼마나 됐는지 + 미달성 이유 회고", type: "longtext", required: true },
  { key: "month_goal_note", label: "이번 4주간 꼭 이뤄야 하는 공부를 과목별로 적은 노트 (큰 틀 목표)", type: "image", required: false },
  { key: "week_plan_note", label: "4주 목표를 위해 이번주에 이룰 구체적 계획 노트", type: "image", required: false },
  { key: "growth_goal", label: "이번 달 이루고 싶은 성장 (공부/생활태도/루틴 등 모든 분야 간단히)", type: "longtext", required: true },
  { key: "nearest_exam", label: "가장 임박한 시험 일정 + 그 시험을 위해 필요한 공부", type: "longtext", required: true },
  { key: "help_wanted", label: "멘토님께 이번주 특히 도움받고 싶은 부분 & 고민", type: "longtext", required: true },
  { key: "memo", label: "메모", type: "longtext", required: false },
];

// 사전 질문지 (pre) — 1주차 사전 컨설팅용. 전부 장문, 파일/동의 없음.
const STUDY_HINT = "인강명, 학원, 과외 등 + 현재 문제점";
export const PRE_FIELDS: ConsultingField[] = [
  { key: "target_univ", label: "목표 대학 & 학과 3가지", type: "longtext", required: true },
  { key: "target_score", label: "목표 대학을 위해 필요한 성적 (내신 & 수능)", type: "longtext", required: true },
  { key: "current_status", label: "현재 나의 과목선택 & 성적대 (내신, 수능 모두)", type: "longtext", required: true },
  { key: "study_korean", label: "국어 현재 공부 형태 및 문제점", hint: STUDY_HINT, type: "longtext", required: true },
  { key: "study_math", label: "수학 현재 공부 형태 및 문제점", hint: STUDY_HINT, type: "longtext", required: true },
  { key: "study_english", label: "영어 현재 공부 형태 및 문제점", hint: STUDY_HINT, type: "longtext", required: true },
  { key: "study_explore", label: "탐구 현재 공부 형태 및 문제점", hint: STUDY_HINT, type: "longtext", required: true },
  { key: "questions_to_mentor", label: "스카이메이트 멘토에게 질문하고 싶은 3가지", hint: "공부법, 인강 외 개인적인 질문 포함", type: "longtext", required: true },
  { key: "four_week_plan", label: "스카이메이트로 4주 동안 이루고 싶은 계획", hint: "성적 X, 전 과목 진도 & 성취 측면, 과목별 최대한 상세히. 단 욕심 부리지 말고 70% 정도로", type: "longtext", required: true },
  { key: "other_goal", label: "그 밖에 4주간 코칭을 통해 이루고 싶은 것 (있다면 상세히)", type: "longtext", required: false },
];

/**
 * 폼 종류별 전체 항목 — 저장된 제출물의 라벨 조회와 제출 검증에 쓴다.
 * 기간 한정 항목(중간고사 결과)도 항상 포함한다. 멘토 화면은 값이 빈 항목을 건너뛰므로
 * 기간 밖 제출물에 빈칸이 생기지 않고, 받아둔 답은 기간이 지나도 계속 보인다.
 */
export function fieldsFor(formType: ConsultingFormType): ConsultingField[] {
  if (formType === "pre") return PRE_FIELDS;
  const base = formType === "monthly" ? MONTHLY_FIELDS : WEEKLY_FIELDS;
  return [MIDTERM_FIELD, ...base];
}

/**
 * 학생에게 실제로 보여줄 항목 — 기간/학년 조건을 만족할 때만 중간고사 결과를 맨 앞에 끼운다.
 * (제출 검증은 fieldsFor 를 쓰므로, 작성 중에 기간이 지나도 적어둔 답이 버려지지 않는다)
 */
export function studentFormFields(
  formType: ConsultingFormType,
  grade: string | null | undefined,
  today: string = todaySeoul(),
): ConsultingField[] {
  if (formType === "pre") return PRE_FIELDS;
  const base = formType === "monthly" ? MONTHLY_FIELDS : WEEKLY_FIELDS;
  return showsMidterm(formType, grade, today) ? [MIDTERM_FIELD, ...base] : base;
}

export const FORM_TITLE: Record<ConsultingFormType, string> = {
  weekly: "주간 성장 코칭 폼",
  monthly: "월간 비전 컨설팅 폼",
  pre: "사전 질문지",
};

// 폼 상단 안내문 / 하단 문구 (값이 있는 폼만 노출)
export const FORM_INTRO: Partial<Record<ConsultingFormType, string>> = {
  pre: "상담을 위한 사전 질문지입니다. 성실하게 작성할수록 상담의 퀄리티가 상승합니다.",
};
export const FORM_OUTRO: Partial<Record<ConsultingFormType, string>> = {
  pre: "진짜 4주간 누구보다 많이 변해봅시다. 잘 부탁드립니다 🫶",
};

// 하단 주의사항 / 동의 항목 (두 폼 공통, 전부 필수 체크)
export type AgreementItem = { key: string; title: string; lines: string[] };

export const AGREEMENTS: AgreementItem[] = [
  {
    key: "principle",
    title: "코칭 시간 및 원칙",
    lines: [
      "사전에 고지된 시간을 지켜 입장해주세요.",
      "웬만하면 캠을 켜주시고, 부득이한 경우엔 멘토에게 말씀해주세요!",
    ],
  },
  {
    key: "entry",
    title: "코칭 입장 방법",
    lines: [
      "줌 코칭은 카톡 방 공지에 있는 줌 회의 링크로 입장하시면 됩니다.",
      "시작 5분 전엔 입장 완료 부탁드립니다.",
      "지각으로 인해 코칭 시작이 지연될 경우 코칭 시간이 연장되지 않습니다.",
    ],
  },
  {
    key: "guide",
    title: "주차별 코칭 가이드",
    lines: [
      "1주차 VISION 코칭: 4주간의 계획을 설계하고 목표를 향한 비전을 체크합니다.",
      "2-4주차 GROWTH 코칭: 한 주간의 학습을 돌아보고 비전을 향한 차주 계획을 수립합니다.",
      "4주마다 변화하는 성적과 상태에 따라 재 점검하며 나아갑니다.",
    ],
  },
  {
    key: "recording",
    title: "코칭 녹화 규정",
    lines: [
      "코칭의 품질 관리와 복습을 위해, 별도의 협의 없이 세션이 녹화됩니다.",
      "모든 녹화물은 내부 교육 및 분쟁 시 확인 용도로만 사용 가능하며, 제3자에게 공개하거나 배포하는 것은 엄격히 금지됩니다.",
    ],
  },
  {
    key: "final",
    title: "최종 동의",
    lines: [
      "위 내용을 제대로 읽지 않아 발생하는 불이익에 대해서는 스카이메이트에서 책임지지 않습니다. 이에 동의하시나요?",
    ],
  },
];
