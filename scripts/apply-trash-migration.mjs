// 컨설팅 제출 휴지통 마이그레이션 적용 여부 확인. 실행: node scripts/apply-trash-migration.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { error } = await sb.from("consulting_submissions").select("id, deleted_at, deleted_by").limit(1);
if (error) {
  console.log("❌ 아직 미적용:", error.message);
  console.log("   supabase/migrations/20260810_consulting_submission_trash.sql 을 SQL Editor 에서 RUN 하세요.");
  process.exit(1);
}
console.log("✅ deleted_at / deleted_by 컬럼 적용 완료 — 휴지통 기능 사용 가능");
