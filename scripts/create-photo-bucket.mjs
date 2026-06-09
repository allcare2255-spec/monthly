// 일별 공부 인증 사진용 Supabase Storage 버킷 생성 (멱등)
// 사용법: node scripts/create-photo-bucket.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
for (const line of raw.split("\n")) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, "");
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const BUCKET = "coaching-photos";

const { data: buckets } = await supabase.storage.listBuckets();
const exists = (buckets || []).some((b) => b.id === BUCKET);

if (exists) {
  const { error } = await supabase.storage.updateBucket(BUCKET, {
    public: true,
    fileSizeLimit: "10MB",
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"],
  });
  console.log(error ? `업데이트 실패: ${error.message}` : `버킷 '${BUCKET}' 이미 존재 → public 설정 갱신 완료`);
} else {
  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: "10MB",
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"],
  });
  console.log(error ? `생성 실패: ${error.message}` : `버킷 '${BUCKET}' 생성 완료 (public)`);
}
