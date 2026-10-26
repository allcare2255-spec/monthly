import "server-only";
import crypto from "crypto";
import { getServiceClient } from "@/lib/supabase";

/**
 * AI 분석용 임시 자료 버킷(비공개).
 *
 * 자료를 API 본문에 실어 보내면 Vercel 요청 한도(4.5MB)에 걸리므로,
 * 브라우저가 서명 URL 로 Supabase 에 직접 올리고 서버는 경로만 받는다.
 * 분석이 끝나면 바로 지운다.
 */
export const UPLOAD_BUCKET = "ai-uploads";

/** 파일 1개 최대 용량. 버킷에도 같은 한도가 걸려 있다. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export interface StoredAsset {
  kind: "image" | "pdf";
  /** 버킷 안의 파일 경로. */
  path: string;
  mediaType: string;
}

export function isAllowedMediaType(mediaType: string) {
  return Boolean(EXT[mediaType]);
}

/** 브라우저가 직접 업로드할 수 있는 1회용 서명 URL 을 발급한다. */
export async function createSignedUpload(mediaType: string, prefix: string) {
  const ext = EXT[mediaType];
  if (!ext) throw new Error("이미지(JPG/PNG/WEBP) 또는 PDF 만 올릴 수 있습니다.");

  const path = `${prefix}/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await getServiceClient()
    .storage.from(UPLOAD_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) throw new Error(error?.message || "업로드 주소 발급에 실패했습니다.");

  return { path: data.path, signedUrl: data.signedUrl, token: data.token };
}

/** 올라온 자료를 Claude 에 넘길 수 있는 base64 로 읽어온다. */
export async function readStoredAssets(stored: StoredAsset[]) {
  const supabase = getServiceClient();
  return Promise.all(
    stored.map(async (s) => {
      const { data, error } = await supabase.storage.from(UPLOAD_BUCKET).download(s.path);
      if (error || !data) {
        throw new Error("업로드한 자료를 읽지 못했습니다. 다시 올려주세요.");
      }
      const buf = Buffer.from(await data.arrayBuffer());
      return { kind: s.kind, data: buf.toString("base64"), mediaType: s.mediaType };
    })
  );
}

/** 분석이 끝난 임시 자료를 지운다. 실패해도 본 작업을 막지 않는다. */
export async function removeStoredAssets(stored: StoredAsset[]) {
  if (stored.length === 0) return;
  try {
    await getServiceClient()
      .storage.from(UPLOAD_BUCKET)
      .remove(stored.map((s) => s.path));
  } catch (e) {
    console.error("[uploads] 임시 자료 삭제 실패", e);
  }
}

/** 요청 본문에서 StoredAsset 목록만 걸러낸다. */
export function parseStoredAssets(value: unknown): StoredAsset[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((v) => {
    const kind = v?.kind === "pdf" ? "pdf" : v?.kind === "image" ? "image" : null;
    if (!kind || typeof v?.path !== "string" || typeof v?.mediaType !== "string") return [];
    if (!isAllowedMediaType(v.mediaType)) return [];
    return [{ kind, path: v.path, mediaType: v.mediaType } as StoredAsset];
  });
}
