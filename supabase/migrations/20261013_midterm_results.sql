-- 2026-10-13 중간고사 결과 (컨설팅 화면 고정 섹션)
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 RUN 하세요.
-- (기존 테이블/컬럼은 건드리지 않고, 테이블 1개만 추가합니다.)

-- 멘토가 컨설팅(줌 화면공유) 중에 학생과 함께 정리하는 중간고사 결과.
--  - 주차가 아니라 '시험' 단위다. 한 번 적어두면 다음 주차 컨설팅에서도 같은 내용이 보인다.
--  - exam_key: 시험 식별자. 예) '2026-2-midterm' (2026학년도 2학기 중간고사)
--  - content : 멘토가 적는 내용 (평문, 줄바꿈 유지)
create table if not exists midterm_results (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references coaching_students(id) on delete cascade,
  exam_key text not null,
  content text not null default '',
  author_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, exam_key)
);

create index if not exists midterm_results_student_idx
  on midterm_results (student_id, exam_key);
