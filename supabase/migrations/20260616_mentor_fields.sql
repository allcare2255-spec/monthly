-- [수정 9~11] 멘토에 고유 번호 / 첫 코칭 시작일 컬럼 추가
alter table coaching_mentors
  add column if not exists unique_number integer,
  add column if not exists first_coaching_date date;
