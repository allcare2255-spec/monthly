-- 2026-06-16 컨설팅 폼에 사전 질문지(pre) 추가
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 RUN 하세요.
-- consulting_submissions.form_type 의 허용값에 'pre' 추가 (기존 'weekly','monthly' 유지)

alter table consulting_submissions
  drop constraint if exists consulting_submissions_form_type_check;

alter table consulting_submissions
  add constraint consulting_submissions_form_type_check
  check (form_type in ('weekly', 'monthly', 'pre'));
