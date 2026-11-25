// 컨설팅 마이그레이션 적용 확인용. 실행: node scripts/check-consulting.mjs
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

// 1) consulting_token 컬럼 + 백필 확인
const { data: students, error: e1 } = await sb
  .from("coaching_students")
  .select("id, name, consulting_token, coaching_start_date")
  .limit(5);
if (e1) {
  console.log("❌ coaching_students.consulting_token 조회 실패:", e1.message);
} else {
  const missing = students.filter((s) => !s.consulting_token).length;
  console.log(`✅ consulting_token 컬럼 OK, 표본 ${students.length}명 중 토큰 없는 학생 ${missing}명`);
  for (const s of students) {
    console.log(`   - ${s.name} | token=${s.consulting_token?.slice(0, 8)}… | start=${s.coaching_start_date}`);
  }
}

// 2) consulting_submissions 테이블 확인
const { error: e2, count } = await sb
  .from("consulting_submissions")
  .select("id", { count: "exact", head: true });
if (e2) console.log("❌ consulting_submissions 테이블 조회 실패:", e2.message);
else console.log(`✅ consulting_submissions 테이블 OK, 현재 제출 ${count ?? 0}건`);
