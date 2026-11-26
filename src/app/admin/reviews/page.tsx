import { listReviewOverview } from "@/lib/review/overview";
import { ReviewsView } from "./reviews-view";

export const dynamic = "force-dynamic";

/** 관리자: 출제일별 복습 테스트 현황 (상태·응시 횟수·점수·풀이 시간) */
export default async function AdminReviewsPage() {
  const rows = await listReviewOverview();
  return <ReviewsView rows={rows} />;
}
