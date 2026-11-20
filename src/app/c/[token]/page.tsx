import type { Metadata } from "next";
import { shareMeta } from "@/lib/share-meta";
import { getStudentByToken } from "@/lib/consulting/store";
import { weekStateForStudent } from "@/lib/consulting/week";
import type { ConsultingFormType } from "@/types";
import ConsultingForm from "./consulting-form";

export const dynamic = "force-dynamic";

const DESC = "컨설팅 전까지 작성해주세요!";

// 카톡에 붙여넣었을 때 누구의 어떤 질문지인지 바로 보이도록
// "OOO학생 17주차 주간 질문지" 형태로 제목을 만든다.
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { token } = await params;
  const sp = await searchParams;
  const forcedRaw = Array.isArray(sp.form) ? sp.form[0] : sp.form;
  const forced =
    forcedRaw === "pre" || forcedRaw === "weekly" || forcedRaw === "monthly"
      ? (forcedRaw as ConsultingFormType)
      : null;

  let type: ConsultingFormType | null = forced;
  let week: number | null = forced === "pre" ? 1 : null;

  // 제목에 학생 이름을 넣으려면 ?form= 이 붙은 링크라도 학생을 조회해야 한다
  const student = await getStudentByToken(token).catch(() => null);
  if (student) {
    const state = weekStateForStudent(student.coachingStartDate, student.cycleAnchors);
    if (state.kind === "form") {
      // ?form= 으로 폼을 지정한 링크라도 주차는 현재 주차를 그대로 쓴다 (사전 질문지는 항상 1주차)
      if (!type) type = state.formType;
      if (week === null) week = state.week;
    }
  }
  const who = student?.name ? `${student.name}학생 ` : "";

  if (!type) {
    return shareMeta("SKY MATE 코칭 질문지", DESC);
  }

  // 주간은 누적 주차 그대로(17주차 18주차…),
  // 월간은 "N개월차" (1주차가 사전 질문지이므로 5주차=2개월차, 9주차=3개월차)
  const cycle = week ? Math.floor((week - 1) / 4) + 1 : null;
  const title =
    who +
    (type === "pre"
      ? "사전 질문지"
      : type === "monthly"
        ? cycle
          ? `${cycle}개월차 월간 질문지`
          : "월간 질문지"
        : week
          ? `${week}주차 주간 질문지`
          : "주간 질문지");

  return shareMeta(title, DESC);
}

export default function ConsultingFormRoute({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return <ConsultingForm params={params} />;
}
