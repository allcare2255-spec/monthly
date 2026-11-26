-- 2026-11-26 복습 테스트 풀이 시간 기록
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 RUN 하세요.
-- 학생이 첫 답을 입력한 순간부터 제출까지 걸린 시간(초). 실행 전 응시 기록은 비어 있다.

alter table review_attempts
  add column if not exists duration_sec integer;
