import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { createSignedUpload, isAllowedMediaType, MAX_UPLOAD_BYTES } from "@/lib/uploads";

export const runtime = "nodejs";

// POST { purpose: "review" | "plan", files: [{ mediaType, size }] }
//   → { uploads: [{ path, signedUrl }] }
// 브라우저가 이 주소로 Supabase 에 직접 올리므로 자료가 API 본문을 거치지 않는다.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  try {
    const body = await req.json();
    const purpose = body.purpose === "plan" ? "plan" : "review";
    const files: { mediaType?: string; size?: number }[] = body.files ?? [];

    if (!Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: "올릴 파일이 없습니다." }, { status: 400 });
    }
    for (const f of files) {
      if (!f?.mediaType || !isAllowedMediaType(f.mediaType)) {
        return NextResponse.json(
          { error: "이미지(JPG/PNG/WEBP) 또는 PDF 만 올릴 수 있습니다." },
          { status: 400 }
        );
      }
      if (typeof f.size === "number" && f.size > MAX_UPLOAD_BYTES) {
        return NextResponse.json(
          { error: `파일 하나당 ${MAX_UPLOAD_BYTES / 1024 / 1024}MB 까지만 올릴 수 있습니다.` },
          { status: 400 }
        );
      }
    }

    const prefix = `${purpose}/${session.mentorId || session.role}`;
    const uploads = await Promise.all(
      files.map(async (f) => {
        const { path, signedUrl } = await createSignedUpload(f.mediaType!, prefix);
        return { path, signedUrl };
      })
    );

    return NextResponse.json({ uploads });
  } catch (e: any) {
    console.error("[/api/uploads/sign]", e);
    return NextResponse.json(
      { error: e?.message || "업로드 준비 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
