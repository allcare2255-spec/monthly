import { shareMeta } from "@/lib/share-meta";
import { DemoTour } from "./demo-tour";

export const metadata = shareMeta(
  "SKY MATE 고등 코칭 체험",
  "멘토 매칭부터 사전 질문지·첫 컨설팅, 커리큘럼·계획표, 매일 카톡 관리, 질의응답, 맞춤 테스트지, 주간·월간 레포트까지 직접 둘러보세요.",
  { index: true },
);

export default function DemoPage() {
  return <DemoTour />;
}
