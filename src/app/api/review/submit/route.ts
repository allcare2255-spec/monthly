import { NextResponse } from "next/server";
import { getReviewSetByCode, saveAttempt } from "@/lib/review/store";
import { gradeQuiz } from "@/lib/review/grade";
import type { ReviewAnswer } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/** 학생 제출 → 채점 + 응시기록 저장. 공개(로그인 불필요). */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const code: string = body.code;
    const answers: ReviewAnswer[] = Array.isArray(body.answers) ? body.answers : [];
    const name: string = (body.name ?? "").toString();

    const set = await getReviewSetByCode(code);
    if (!set) {
      return NextResponse.json(
        { error: "해당 코드의 복습을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const result = await gradeQuiz(set, answers);

    // 응시 기록 저장 실패가 채점 결과 반환을 막지 않도록 한다.
    try {
      await saveAttempt(set, name, result);
    } catch (e) {
      console.error("[/api/review/submit] 응시 기록 저장 실패:", e);
    }

    return NextResponse.json({ result });
  } catch (e: any) {
    console.error("[/api/review/submit]", e);
    return NextResponse.json(
      { error: e?.message || "채점 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
