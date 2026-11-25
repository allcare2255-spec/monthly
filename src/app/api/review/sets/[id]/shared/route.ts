import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getReviewSetById, markReviewSetShared } from "@/lib/review/store";

export const runtime = "nodejs";

/** 멘토가 '링크 복사'를 누르면 공유 시각을 남긴다 → 진행상황 '문제 풀이 중'. */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const { id } = await params;
  const set = await getReviewSetById(id);
  if (!set) return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
  if (session.role !== "admin" && set.mentorId !== session.mentorId) {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }
  const ok = await markReviewSetShared(id);
  return NextResponse.json({ ok });
}
