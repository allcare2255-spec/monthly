import { NextResponse } from "next/server";
import { getStudentByToken } from "@/lib/consulting/store";
import { weekStateForStudent } from "@/lib/consulting/week";
import { fieldsFor, FORM_TITLE, FORM_INTRO, FORM_OUTRO, AGREEMENTS } from "@/lib/consulting/forms";
import type { ConsultingFormType } from "@/types";

type Prefill = { name: string; phone: string | null; mentorName: string | null };

function formPayload(formType: ConsultingFormType, week: number, prefill: Prefill) {
  return {
    prefill,
    state: "form" as const,
    week,
    formType,
    title: FORM_TITLE[formType],
    fields: fieldsFor(formType),
    // pre 는 동의 항목 없음
    agreements: formType === "pre" ? [] : AGREEMENTS,
    intro: FORM_INTRO[formType] ?? null,
    outro: FORM_OUTRO[formType] ?? null,
  };
}

// GET /api/consulting/[token]            → 현재 주차에 맞는 폼 (1주차면 사전 질문지)
// GET /api/consulting/[token]?form=pre   → 주차 무시하고 사전 질문지 (가입 직후 직접 안내용)
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const student = await getStudentByToken(token);
  if (!student) {
    return NextResponse.json({ error: "유효하지 않은 링크입니다." }, { status: 404 });
  }

  const prefill: Prefill = {
    name: student.name,
    phone: student.phone,
    mentorName: student.mentorName,
  };

  const state = weekStateForStudent(student.coachingStartDate);

  // 폼 지정 직접 링크 (?form=pre) — 주차/시작여부 무시
  const forced = new URL(req.url).searchParams.get("form");
  if (forced === "pre") {
    const week = state.kind === "form" ? state.week : 1;
    return NextResponse.json(formPayload("pre", week, prefill));
  }

  if (state.kind === "not_started") {
    return NextResponse.json({ prefill, state: "not_started" });
  }

  return NextResponse.json(formPayload(state.formType, state.week, prefill));
}
