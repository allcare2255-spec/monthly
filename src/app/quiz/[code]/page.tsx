import type { Metadata } from "next";
import { shareMeta } from "@/lib/share-meta";
import { getReviewSetByCode } from "@/lib/review/store";
import QuizView from "./quiz-view";

export const dynamic = "force-dynamic";

// 카톡 미리보기에 테스트지 제목(과목)이 보이게 한다
export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const set = await getReviewSetByCode(code).catch(() => undefined);
  const name = (set?.title || "").trim();
  const subject = (set?.subject || "").trim();
  // 세트 제목에 이미 "복습 테스트"가 들어 있으면 덧붙이지 않는다
  const withSuffix = (t: string) => (/테스트|복습/.test(t) ? t : `${t} 복습 테스트`);
  const title = name
    ? withSuffix(name)
    : subject
      ? `${subject} 복습 테스트`
      : "SKY MATE 복습 테스트";
  return shareMeta(
    title,
    "SKY MATE 맞춤 복습 테스트입니다. 눌러서 문제를 풀고 바로 채점받아 보세요.",
  );
}

export default function QuizRoute() {
  return <QuizView />;
}
