import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { generateQuiz, type UploadAsset } from "@/lib/review/anthropic";
import { parseStoredAssets, readStoredAssets, removeStoredAssets } from "@/lib/uploads";

export const runtime = "nodejs";
export const maxDuration = 300; // AI 생성은 시간이 걸릴 수 있음 (Pro 플랜 상한)

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  // 스토리지에 올린 자료(uploads)를 우선 쓰고, 예전 방식(assets, base64)도 받아준다.
  const stored = parseStoredAssets(body.uploads);

  try {
    const hint: string | undefined = body.hint;
    const assets: UploadAsset[] =
      stored.length > 0 ? await readStoredAssets(stored) : body.assets ?? [];

    if (!Array.isArray(assets) || assets.length === 0) {
      return NextResponse.json(
        { error: "자료(이미지 또는 PDF)를 1개 이상 올려주세요." },
        { status: 400 }
      );
    }

    const quiz = await generateQuiz(assets, hint);
    return NextResponse.json({ quiz });
  } catch (e: any) {
    console.error("[/api/review/generate]", e);
    const msg =
      e?.message?.includes("ANTHROPIC_API_KEY") || e?.status === 401
        ? "Claude API 키가 올바르지 않습니다. .env.local 을 확인하세요."
        : e?.message || "문제 생성 중 오류가 발생했습니다.";
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    await removeStoredAssets(stored);
  }
}
