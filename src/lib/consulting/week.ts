// 컨설팅 폼 주차 → 폼 종류 판정 (server/client 공용, 순수 함수)
import type { ConsultingFormType } from "@/types";
import { weeksSinceStart, todaySeoul } from "@/lib/dates";

export type WeekState =
  | { kind: "not_started"; week: 0 }                 // 코칭 시작 전 / 시작일 미등록
  | { kind: "form"; week: number; formType: ConsultingFormType };

/**
 * 누적 주차로 폼 종류를 결정한다.
 * - 1주차: 사전 질문지(pre)
 * - (주차-1) % 4 === 0 (5,9,13…): 월간 비전 컨설팅
 * - 그 외(2,3,4,6,7,8…): 주간 성장 코칭
 */
export function weekStateFromWeek(week: number): WeekState {
  if (week <= 0) return { kind: "not_started", week: 0 };
  if (week === 1) return { kind: "form", week: 1, formType: "pre" };
  const formType: ConsultingFormType = (week - 1) % 4 === 0 ? "monthly" : "weekly";
  return { kind: "form", week, formType };
}

/**
 * 학생의 코칭 시작일(월요일) 기준 오늘(KST)의 누적 주차 → 폼 상태.
 * 멘토 학생 상세 페이지의 currentWeek 계산과 동일한 방식(raw start)을 사용한다.
 *
 * 컨설팅은 항상 '다음 주'를 준비하기 위해 진행되므로, 폼 종류는 현재 주차가 아니라
 * (현재 주차 + 1) 기준으로 결정한다.
 * - 1주차에 접속 → 2주차 준비용 주간 성장 코칭
 * - 4주차에 접속 → 5주차(새 달 시작) 준비용 월간 비전 컨설팅
 * 단, 아직 코칭 시작 전(week <= 0)이면 not_started 를 유지한다.
 */
export function weekStateForStudent(coachingStartDate: string | null): WeekState {
  if (!coachingStartDate) return { kind: "not_started", week: 0 };
  const week = weeksSinceStart(coachingStartDate, todaySeoul());
  if (week <= 0) return { kind: "not_started", week: 0 };
  return weekStateFromWeek(week + 1);
}
