-- 2026-08-04 멘토 컨설팅 메모 (컨설팅 화면 우측 작성란)
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 RUN 하세요.
-- (기존 테이블/컬럼은 건드리지 않고, 테이블 1개만 추가합니다.)

-- 멘토가 컨설팅(줌 상담) 중에 학생 제출 폼을 보면서 작성하는 메모.
--  - 학생 + 누적 주차 1건 (제출물이 없어도 미리 작성 가능하도록 submission 이 아닌 week 기준)
--  - note: 자유 서식 없는 순수 텍스트 (줄바꿈 유지)
create table if not exists consulting_notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references coaching_students(id) on delete cascade,
  week_number int not null,
  note text not null default '',
  author_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, week_number)
);

create index if not exists consulting_notes_student_idx
  on consulting_notes (student_id, week_number);
