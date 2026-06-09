-- 2026-06-09 주간 계획표 / 사진 첨부 기능용 스키마 변경
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 RUN 하세요.

-- [수정 3] 주간 계획표 (학생/월차/주차 단위, 노션형 자동저장 JSON)
--   plan_data 구조:
--   {
--     "weekly_goals": [{ "id": "...", "text": "...", "done": false }],
--     "main_test":    ["수학 모의고사", "영단어 시험"],
--     "days": {
--       "mon": { "notes": "...", "tasks": [{ "id","text","done" }] }, ... "sun": {...}
--     },
--     "summary": { "achievement": "...", "feedback": "..." }
--   }
create table if not exists coaching_weekly_plans (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references coaching_students(id) on delete cascade,
  cycle_number int not null,
  week_number int not null,
  plan_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, cycle_number, week_number)
);

create index if not exists coaching_weekly_plans_student_idx
  on coaching_weekly_plans (student_id);

-- [수정 5] 일별 공부 인증 사진 저장용 스토리지 버킷 (public read)
--   * 서버(API)에서 service-role 키로 업로드/삭제하므로 별도 정책은 불필요.
--   * 앱 코드(scripts/create-photo-bucket.mjs)로도 생성되지만, 여기에서도 보장.
insert into storage.buckets (id, name, public)
values ('coaching-photos', 'coaching-photos', true)
on conflict (id) do update set public = true;
