-- 2026-08-10 컨설팅 제출 내역 휴지통 (소프트 삭제)
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 RUN 하세요.
-- 멘토/관리자가 제출 내역을 삭제하면 바로 지우지 않고 deleted_at 을 찍어 휴지통으로 보낸다.
-- 보관 기간은 무기한 — '영구삭제'를 눌러야 실제 행/이미지가 사라진다.

alter table consulting_submissions
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by text;

-- 살아있는 제출만 훑는 목록 조회용 부분 인덱스
create index if not exists consulting_submissions_active_idx
  on consulting_submissions (student_id, submitted_at desc)
  where deleted_at is null;

-- 휴지통 목록 조회용
create index if not exists consulting_submissions_trash_idx
  on consulting_submissions (student_id, deleted_at desc)
  where deleted_at is not null;
