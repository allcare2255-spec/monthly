/**
 * 브라우저에서 Supabase 로 자료를 직접 올리는 헬퍼.
 *
 * 파일을 API 본문에 담아 보내면 Vercel 요청 한도(4.5MB)에 걸리므로,
 * 서버에서 1회용 서명 URL 만 받아 브라우저가 스토리지로 바로 올린다.
 */

/** 파일 1개 최대 용량. 서버·버킷에도 같은 한도가 걸려 있다. */
export const MAX_UPLOAD_BYTES = 25_000_000;

export interface StoredUpload {
  kind: "image" | "pdf";
  path: string;
  mediaType: string;
}

export const formatBytes = (bytes: number) => `${(bytes / 1_000_000).toFixed(1)}MB`;

export async function uploadAssets(
  files: File[],
  purpose: "review" | "plan"
): Promise<StoredUpload[]> {
  if (files.length === 0) return [];

  const signRes = await fetch("/api/uploads/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      purpose,
      files: files.map((f) => ({ mediaType: f.type, size: f.size })),
    }),
  });
  const signJson = await signRes.json().catch(() => null);
  if (!signRes.ok || !signJson?.uploads) {
    throw new Error(signJson?.error || "업로드 준비에 실패했습니다.");
  }
  const slots = signJson.uploads as { path: string; signedUrl: string }[];

  await Promise.all(
    files.map(async (file, i) => {
      const res = await fetch(slots[i].signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new Error(`${file.name} 업로드에 실패했습니다. 다시 시도해 주세요.`);
    })
  );

  return files.map((file, i) => ({
    kind: file.type === "application/pdf" ? "pdf" : "image",
    path: slots[i].path,
    mediaType: file.type,
  }));
}
