import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getReviewSetById, listAttemptsBySet } from "@/lib/review/store";

export const runtime = "nodejs";

/** 세트 상세(문제 전체 포함) + 응시 기록, 멘토/관리자. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const { id } = await params;
  try {
    const set = await getReviewSetById(id);
    if (!set) return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
    // 멘토는 본인 세트만 (admin은 전체 허용)
    if (session.role !== "admin" && set.mentorId !== session.mentorId) {
      return NextResponse.json({ error: "권한 없음" }, { status: 403 });
    }
    const attempts = await listAttemptsBySet(id);
    return NextResponse.json({ set, attempts });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "조회 실패" }, { status: 500 });
  }
}
