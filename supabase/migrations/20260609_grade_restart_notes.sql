-- 2026-06-09 변경사항용 스키마 변경
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 RUN 하세요.

-- [변경 1] 학생 "학년" (나이 대신 고1/고2/고3/재수생/N수생 문자열)
alter table coaching_students
  add column if not exists grade text;

-- [변경 2-2] 레포트 페이지 관리자 전용 메모 목록 (월차별)
alter table coaching_cycles
  add column if not exists notes jsonb not null default '[]'::jsonb;

-- [변경 3] 코칭 재시작 앵커
--  특정 월차(cycle_number)부터 새로운 기준일(start_date)로 날짜를 계산.
--  cycle 시작일 = "해당 cycle 이하의 가장 큰 앵커" 기준 + (cycle - 앵커cycle)*28
--  기본 앵커는 coaching_students.coaching_start_date (cycle 1)로 암묵 처리.
create table if not exists coaching_restarts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references coaching_students(id) on delete cascade,
  cycle_number int not null,
  start_date date not null,
  created_at timestamptz not null default now(),
  unique (student_id, cycle_number)
);

create index if not exists coaching_restarts_student_idx
  on coaching_restarts (student_id);
