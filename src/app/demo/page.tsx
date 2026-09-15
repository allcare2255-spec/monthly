import type { Metadata } from "next";
import { DemoTour } from "./demo-tour";

export const metadata: Metadata = {
  title: "SKY MATE 고등 코칭 체험",
  description: "멘토가 매주 세우는 계획표, 매일 카톡 관리, 주간 줌 컨설팅, 주간·월간 레포트를 직접 둘러보세요.",
};

export default function DemoPage() {
  return <DemoTour />;
}
