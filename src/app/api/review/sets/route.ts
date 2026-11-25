import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { saveReviewSet, listReviewSetsByMentor } from "@/lib/review/store";
import type { ReviewQuiz } from "@/types";

export const runtime = "nodejs";

/** 복습 세트 저장(배포), 멘토/관리자. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  try {
    const body = await req.json();
    const quiz: ReviewQuiz = body.quiz;
    const studentId: string | null = body.studentId || null;
    const subject: string | null = body.subject || null;

    if (!quiz || !Array.isArray(quiz.questions) || quiz.questions.length === 0) {
      return NextResponse.json({ error: "저장할 문제가 없습니다." }, { status: 400 });
    }

    const set = await saveReviewSet(quiz, {
      mentorId: session.mentorId ?? null,
      studentId,
      subject,
    });
    return NextResponse.json({ code: set.code, id: set.id });
  } catch (e: any) {
    console.error("[/api/review/sets POST]", e);
    return NextResponse.json(
      { error: e?.message || "저장 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

/** 내 복습 세트 목록, 멘토. (admin은 mentorId 없으면 빈 목록) */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  if (!session.mentorId) return NextResponse.json({ sets: [] });

  try {
    const sets = await listReviewSetsByMentor(session.mentorId);
    return NextResponse.json({ sets });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "조회 실패" }, { status: 500 });
  }
}
