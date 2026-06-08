-- 2026-06-08 레포트 관리 수정사항용 스키마 변경
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 RUN 하세요.

-- [수정 6,7] 학생 "코칭 종료" 상태 (삭제하지 않고 별도 관리)
alter table coaching_students
  add column if not exists coaching_ended boolean not null default false;

-- [수정 9] 코칭 월차별 날짜 오버라이드 + 자유 메모
create table if not exists coaching_cycles (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references coaching_students(id) on delete cascade,
  cycle_number int not null,
  start_date date,
  end_date date,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, cycle_number)
);

create index if not exists coaching_cycles_student_idx
  on coaching_cycles (student_id);
