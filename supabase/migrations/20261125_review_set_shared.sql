-- 2026-11-25 복습 테스트 진행상황 (링크 공유 전 / 문제 풀이 중 / 진행 완료)
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 RUN 하세요.
-- 멘토가 상세 화면에서 '링크 복사'를 처음 누른 시각을 남긴다. 값이 있으면 '문제 풀이 중'.
-- (학생이 한 번이라도 제출하면 review_attempts 기준으로 '진행 완료')

alter table review_sets
  add column if not exists shared_at timestamptz;
