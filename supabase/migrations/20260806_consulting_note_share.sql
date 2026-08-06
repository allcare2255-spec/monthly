-- 2026-08-06 컨설팅 기록 공개 링크 (주차 1개 단위)
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 RUN 하세요.
-- (기존 테이블/데이터는 건드리지 않고, consulting_notes 에 컬럼 2개만 추가합니다.)

-- share_token   : 추측 불가능한 공개 주소. 한 번 만들면 계속 유지되고,
--                 "링크 새로 만들기" 를 누를 때만 새 값으로 바뀐다(= 이전 링크 무효화).
-- share_enabled : 켜기/끄기 스위치. false 면 링크를 알아도 열리지 않는다.
alter table consulting_notes add column if not exists share_token text;
alter table consulting_notes add column if not exists share_enabled boolean not null default false;

-- 토큰은 있을 때만 유일해야 하므로 부분 유니크 인덱스를 쓴다
create unique index if not exists consulting_notes_share_token_key
  on consulting_notes (share_token)
  where share_token is not null;
