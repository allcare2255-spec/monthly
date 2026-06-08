// 기존 데이터 월요일 정렬 보정 마이그레이션
// - coaching_students.coaching_start_date  → 월요일로 스냅
// - coaching_restarts.start_date           → 월요일로 스냅
// - coaching_weekly_reports                → 보정된 시작일 기준으로 day_data 날짜/start_date/end_date 재계산
//                                            (요일별 입력 데이터는 배열 순서를 유지한 채 날짜만 교체)
//
// 사용법:
//   node scripts/fix-monday-alignment.mjs          # dry-run (변경 미리보기만)
//   node scripts/fix-monday-alignment.mjs --apply  # 실제 반영
//
// 환경변수: .env.local 의 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 사용

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── .env.local 로드 (의존성 없이 간단 파싱) ──
function loadEnv() {
  const raw = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();

// ── 날짜 유틸 (src/lib/dates.ts 와 동일 로직) ──
function addDays(yyyymmdd, days) {
  const [y, m, d] = yyyymmdd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}
function mondayOf(yyyymmdd) {
  const parts = yyyymmdd.split("-").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return yyyymmdd;
  const [y, m, d] = parts;
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay();
  const shift = dow === 0 ? 1 : -(dow - 1);
  dt.setUTCDate(dt.getUTCDate() + shift);
  return dt.toISOString().slice(0, 10);
}
function resolveCycleStart(coachingStart, cycle, anchors = []) {
  const all = [{ cycle: 1, start_date: coachingStart }, ...anchors]
    .filter((a) => !!a.start_date)
    .sort((a, b) => a.cycle - b.cycle);
  let chosen = all[0];
  for (const a of all) {
    if (a.cycle <= cycle) chosen = a;
    else break;
  }
  return addDays(chosen.start_date, (cycle - chosen.cycle) * 28);
}

const APPLY = process.argv.includes("--apply");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const log = (...a) => console.log(...a);
let changes = 0;

async function main() {
  log(APPLY ? "▶ APPLY 모드 — 실제로 DB를 수정합니다\n" : "▶ DRY-RUN 모드 — 변경 미리보기만 (반영하려면 --apply)\n");

  const { data: students, error } = await supabase
    .from("coaching_students")
    .select("id, name, coaching_start_date");
  if (error) throw error;

  for (const s of students) {
    if (!s.coaching_start_date) continue;
    const oldStart = s.coaching_start_date;
    const newStart = mondayOf(oldStart);

    // 1) 학생 시작일
    if (newStart !== oldStart) {
      log(`학생 [${s.name}] 시작일: ${oldStart} → ${newStart}`);
      changes++;
      if (APPLY) {
        const { error: e } = await supabase
          .from("coaching_students")
          .update({ coaching_start_date: newStart })
          .eq("id", s.id);
        if (e) throw e;
      }
    }

    // 2) 재시작 앵커
    const { data: restarts } = await supabase
      .from("coaching_restarts")
      .select("cycle_number, start_date")
      .eq("student_id", s.id);
    const newAnchors = [];
    for (const r of restarts || []) {
      const newAnchor = mondayOf(r.start_date);
      newAnchors.push({ cycle: r.cycle_number, start_date: newAnchor });
      if (newAnchor !== r.start_date) {
        log(`  └ 재시작 앵커(${r.cycle_number}개월차): ${r.start_date} → ${newAnchor}`);
        changes++;
        if (APPLY) {
          const { error: e } = await supabase
            .from("coaching_restarts")
            .update({ start_date: newAnchor })
            .eq("student_id", s.id)
            .eq("cycle_number", r.cycle_number);
          if (e) throw e;
        }
      }
    }

    // 3) 주간 레포트 day_data 재정렬
    const { data: weeklies } = await supabase
      .from("coaching_weekly_reports")
      .select("id, cycle_number, week_number, start_date, end_date, day_data")
      .eq("student_id", s.id);

    for (const w of weeklies || []) {
      const cycleStart = resolveCycleStart(newStart, w.cycle_number, newAnchors);
      const weekStart = addDays(cycleStart, (w.week_number - 1) * 7);
      const weekEnd = addDays(weekStart, 6);
      const newDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

      const dd = Array.isArray(w.day_data) ? w.day_data : [];
      const newDayData = dd.map((entry, i) => ({ ...entry, date: newDates[i] ?? entry.date }));

      const datesChanged =
        w.start_date !== weekStart ||
        w.end_date !== weekEnd ||
        dd.some((entry, i) => entry.date !== newDates[i]);

      if (datesChanged) {
        log(`  └ ${w.cycle_number}개월차 ${w.week_number}주차: ${w.start_date}~${w.end_date} → ${weekStart}~${weekEnd}`);
        changes++;
        if (APPLY) {
          const { error: e } = await supabase
            .from("coaching_weekly_reports")
            .update({ start_date: weekStart, end_date: weekEnd, day_data: newDayData })
            .eq("id", w.id);
          if (e) throw e;
        }
      }
    }
  }

  log(`\n총 ${changes}건 ${APPLY ? "반영 완료" : "변경 예정"}.`);
  if (!APPLY && changes > 0) log("→ 실제 반영: node scripts/fix-monday-alignment.mjs --apply");
}

main().catch((e) => {
  console.error("실패:", e.message || e);
  process.exit(1);
});
