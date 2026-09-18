import { TEAM, TESTIMONIALS } from "./demo-data";

/**
 * 체험 페이지 단계 목록 — 화면(demo-tour)과 집계(/admin/demo)가 같은 정의를 쓴다.
 * 순서를 바꾸면 집계 퍼널 순서도 함께 바뀐다.
 */
export type DemoStepDef = { key: string; label: string };

export const DEMO_STEPS: DemoStepDef[] = [
  { key: "match", label: "멘토 매칭" },
  { key: "pre", label: "사전 질문지" },
  { key: "first-zoom", label: "첫 컨설팅" },
  { key: "plan", label: "주간 계획" },
  { key: "kakao", label: "매일 카톡 관리" },
  { key: "qna", label: "질의응답" },
  { key: "test", label: "맞춤 테스트지" },
  { key: "zoom", label: "주간 줌 컨설팅" },
  { key: "weekly", label: "주간 레포트" },
  { key: "monthly", label: "월간 레포트" },
  ...(TEAM.length > 0 ? [{ key: "team", label: "3인 관리" }] : []),
  { key: "compare", label: "비교" },
  { key: "results", label: "성적 향상 · 후기" },
  ...(TESTIMONIALS.length > 0 ? [{ key: "reviews", label: "후기" }] : []),
];
