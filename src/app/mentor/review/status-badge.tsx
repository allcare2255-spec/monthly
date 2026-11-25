import type { ReviewStatus } from "@/lib/review/store";

const STYLE: Record<ReviewStatus, string> = {
  "링크 공유 전": "bg-ink/[0.06] text-ink/55",
  "문제 풀이 중": "bg-amber-100 text-amber-800",
  "진행 완료": "bg-emerald-100 text-emerald-700",
};

/** 복습 테스트 진행상황 표시 (링크 공유 전 / 문제 풀이 중 / 진행 완료) */
export function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  return <span className={`font-bold rounded-full px-2.5 py-1 ${STYLE[status]}`}>{status}</span>;
}
