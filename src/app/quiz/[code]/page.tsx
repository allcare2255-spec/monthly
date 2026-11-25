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
  // 미리보기 제목은 "공통영어2 워크북 어법"처럼 과목·단원만: 끝의 날짜 괄호 "(11/24)"는 빼고,
  // "복습 테스트" 같은 말도 덧붙이지 않는다
  const name = (set?.title || "").replace(/\s*\(\d{1,2}\/\d{1,2}(\s*~\s*\d{1,2}\/\d{1,2})?\)\s*$/, "").trim();
  const subject = (set?.subject || "").trim();
  const title = name || subject || "SKY MATE";
  return shareMeta(
    title,
    "SKY MATE 맞춤 복습 테스트입니다. 눌러서 문제를 풀고 바로 채점받아 보세요.",
  );
}

export default function QuizRoute() {
  return <QuizView />;
}
