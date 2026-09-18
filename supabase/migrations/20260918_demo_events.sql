-- 2026-09-18 체험 페이지(/demo) 방문 기록
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 RUN 하세요.
--
-- ※ 이 데이터는 사이트 화면에 절대 노출하지 않는다.
--    조회 경로는 scripts/demo-stats.mjs (service_role) 하나뿐이다.

-- 개인 링크 발급 대장 (?c=<code> → 누구에게 준 링크인지)
create table if not exists demo_links (
  code        text primary key,
  label       text not null,          -- 받는 사람 (예: 고2 김OO 학부모님)
  who_type    text,                   -- parent | student | etc
  grade       text,                   -- 고1 · 고2 · 고3 · N수 …
  channel     text,                   -- 카카오채널 · 전화 · 인스타 · 소개 …
  contact     text,                   -- 카톡 닉네임/연락처 등 식별 메모
  memo        text,                   -- 상담 내용 메모
  created_at  timestamptz not null default now(),
  created_by  text                    -- 발급한 관리자
);

create table if not exists demo_events (
  id          bigserial primary key,
  created_at  timestamptz not null default now(),

  -- 식별
  visitor_id  text not null,   -- 기기 단위(localStorage) → 재방문 판정
  session_id  text not null,   -- 방문 1회(sessionStorage)
  code        text,            -- 개인 링크 코드(?c=)
  visit_no    int,             -- 이 기기의 몇 번째 방문인지

  -- 이벤트
  event       text not null,   -- view | step | consult | leave | ping
  step_index  int,             -- 0-based
  step_key    text,
  step_label  text,
  max_step    int,             -- 이 시점까지 도달한 최고 단계

  -- 시간(ms)
  dwell_ms    int,             -- 페이지 진입 후 경과
  step_ms     int,             -- 직전 단계에 머문 시간
  active_ms   int,             -- 화면을 실제로 보고 있던 시간

  -- 행동
  nav          text,           -- next | back | chip | auto | hidden | pagehide
  from_index   int,            -- 직전 단계
  scroll_pct   int,            -- 해당 단계에서 내려본 최대 깊이(%)
  back_count   int,
  chip_count   int,
  consult_from text,           -- header | footer

  -- 환경
  referrer    text,
  entry_path  text,
  device      text,            -- mobile | tablet | desktop
  os          text,
  browser     text,
  inapp       text,            -- kakao | naver | instagram | line | facebook
  screen_w    int,
  screen_h    int,
  viewport_w  int,
  viewport_h  int,
  dpr         numeric,
  lang        text,
  tz          text,
  ip_hash     text,            -- 원본 IP는 저장하지 않는다(해시 앞 16자리)
  geo_city    text,
  geo_region  text,
  geo_country text,
  ua          text
);

create index if not exists demo_events_session_idx on demo_events (session_id, id);
create index if not exists demo_events_created_idx on demo_events (created_at desc);
create index if not exists demo_events_code_idx    on demo_events (code);
create index if not exists demo_events_visitor_idx on demo_events (visitor_id);

-- RLS 켜고 정책은 만들지 않는다 = anon/authenticated 는 읽기/쓰기 전면 차단.
-- 기록은 서버 라우트(service_role)로만 들어가고, 조회도 service_role 로만 한다.
alter table demo_events enable row level security;
alter table demo_links  enable row level security;
