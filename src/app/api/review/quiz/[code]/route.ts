import { NextResponse } from "next/server";
import { getReviewSetByCode, getStudentNameForSet, toPublicReviewQuiz } from "@/lib/review/store";

export const runtime = "nodejs";

/** 학생용, 정답이 제거된 퀴즈. 공개(로그인 불필요). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  try {
    const set = await getReviewSetByCode(code);
    if (!set) {
      return NextResponse.json(
        { error: "해당 코드의 복습을 찾을 수 없습니다." },
        { status: 404 }
      );
    }
    const studentName = await getStudentNameForSet(set);
    return NextResponse.json({ quiz: toPublicReviewQuiz(set, studentName) });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "불러오기 실패" },
      { status: 500 }
    );
  }
}
