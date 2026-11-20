import type { Metadata } from "next";
import { shareMeta } from "@/lib/share-meta";
import { getStudentByToken } from "@/lib/consulting/store";
import { weekStateForStudent } from "@/lib/consulting/week";
import { FORM_TITLE } from "@/lib/consulting/forms";
import type { ConsultingFormType } from "@/types";
import ConsultingForm from "./consulting-form";

export const dynamic = "force-dynamic";

const DESC: Record<ConsultingFormType, string> = {
  pre: "상담 전에 작성하는 사전 질문지입니다. 성실하게 작성할수록 상담의 퀄리티가 올라갑니다.",
  weekly: "이번 주 학습을 돌아보는 주간 질문지입니다. 눌러서 작성해 주세요.",
  monthly: "한 달을 정리하는 월간 비전 컨설팅 질문지입니다. 눌러서 작성해 주세요.",
};

// 카톡에 붙여넣었을 때 어떤 질문지인지 바로 보이도록 폼 종류를 제목에 쓴다.
// (학생 이름은 넣지 않는다 — 단체방에 붙여넣어도 개인정보가 새지 않게)
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
  const who = student?.name ? `${student.name} 학생 ` : "";

  if (!type) {
    return shareMeta("SKY MATE 코칭 질문지", "SKY MATE 코칭 질문지입니다. 눌러서 작성해 주세요.");
  }

  // week 는 누적 주차(1,2,3…)이므로 학생이 쓰는 "N개월차 M주차"로 바꿔 보여 준다
  const cycle = week ? Math.floor((week - 1) / 4) + 1 : null;
  const weekInCycle = week ? ((week - 1) % 4) + 1 : null;
  const title =
    who +
    (type === "pre"
      ? "사전 질문지"
      : cycle && weekInCycle
        ? type === "monthly"
          ? `${cycle}개월차 ${FORM_TITLE[type]}`
          : `${cycle}개월차 ${weekInCycle}주차 ${FORM_TITLE[type]}`
        : FORM_TITLE[type]);

  return shareMeta(title, DESC[type]);
}

export default function ConsultingFormRoute({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return <ConsultingForm params={params} />;
}
