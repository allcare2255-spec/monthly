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
    // 풀이 시간(초): 첫 답 입력부터 제출까지. 이상한 값(음수, 하루 초과)은 버린다.
    const rawDur = Number(body.durationSec);
    const durationSec = Number.isFinite(rawDur) && rawDur >= 0 && rawDur <= 86400 ? Math.round(rawDur) : null;

    const set = await getReviewSetByCode(code);
    if (!set) {
      return NextResponse.json(
        { error: "해당 코드의 복습을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 오답 재시험: 고른 문항만 채점하고, 결과 번호는 원래 문항 번호로 되돌린다
    const only: number[] | null =
      Array.isArray(body.only) &&
      body.only.length > 0 &&
      body.only.every((n: unknown) => Number.isInteger(n) && (n as number) >= 0 && (n as number) < set.questions.length)
        ? Array.from(new Set<number>(body.only)).sort((a, b) => a - b)
        : null;

    let result;
    if (only) {
      result = await gradeQuiz(
        { ...set, questions: only.map((i) => set.questions[i]) },
        only.map((i) => answers[i] ?? "")
      );
      result.items = result.items.map((it, k) => ({ ...it, index: only[k] }));
    } else {
      result = await gradeQuiz(set, answers);
    }

    // 응시 기록 저장 실패가 채점 결과 반환을 막지 않도록 한다.
    try {
      await saveAttempt(only ? { ...set, title: `${set.title} (오답 다시 풀기)` } : set, name, result, durationSec);
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
