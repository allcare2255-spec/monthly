import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { extractWeeklyPlan } from "@/lib/plan/extract";
import type { UploadAsset } from "@/lib/review/anthropic";

export const runtime = "nodejs";
export const maxDuration = 120; // 비전 추출은 시간이 걸릴 수 있음

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  try {
    const body = await req.json();
    const assets: UploadAsset[] = body.assets ?? [];
    if (!Array.isArray(assets) || assets.length === 0) {
      return NextResponse.json(
        { error: "주간 계획표 사진을 1개 이상 올려주세요." },
        { status: 400 },
      );
    }

    const plan_data = await extractWeeklyPlan(assets);
    return NextResponse.json({ plan_data });
  } catch (e: any) {
    console.error("[/api/plans/extract]", e);
    const msg =
      e?.message?.includes("ANTHROPIC_API_KEY") || e?.status === 401
        ? "Claude API 키가 올바르지 않습니다. .env.local 을 확인하세요."
        : e?.message || "계획표 인식 중 오류가 발생했습니다.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
