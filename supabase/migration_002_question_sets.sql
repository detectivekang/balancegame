-- ============================================================================
-- 마이그레이션 002: 문제집(question_sets) 도입
-- 구조: 카테고리 > 문제집 > 문제
-- Supabase 대시보드 > SQL Editor 에서 이 파일 전체를 붙여넣고 실행하세요.
-- (schema.sql을 이미 실행한 프로젝트에 추가로 적용하는 파일입니다)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. question_sets: 문제집(테마별 문제 묶음)
--    유저도 만들 수 있게 열어둠 -> 문제집 자체는 바로 노출, 그 안의 개별 문제는
--    기존처럼 questions.status='pending' 승인 절차를 그대로 거침.
-- ----------------------------------------------------------------------------
create table question_sets (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  title text not null check (char_length(title) between 1 and 40),
  emoji text not null default '🎯',
  description text,
  creator_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table question_sets enable row level security;

create policy "question sets are viewable by everyone"
  on question_sets for select
  using (true);

create policy "logged in users can create question sets"
  on question_sets for insert
  with check (auth.uid() is not null and creator_id = auth.uid());

create policy "admin can update question sets"
  on question_sets for update
  using (is_admin());

create policy "admin can delete question sets"
  on question_sets for delete
  using (is_admin());

-- ----------------------------------------------------------------------------
-- 2. questions.set_id: 문제가 속한 문제집 (nullable = 문제집 미지정 문제도 허용)
-- ----------------------------------------------------------------------------
alter table questions add column set_id uuid references question_sets(id) on delete set null;

create index questions_set_id_idx on questions(set_id);

-- ----------------------------------------------------------------------------
-- 3. 기존 문제들을 카테고리별 "기본 문제집"에 묶어서 마이그레이션(선택 사항).
--    새 카테고리 구조를 쓰기 전에 등록되어 있던 승인된 문제가 있다면
--    아래 블록이 카테고리당 "○○ 모음집" 문제집을 자동 생성해 묶어줍니다.
-- ----------------------------------------------------------------------------
do $$
declare
  r record;
  v_set_id uuid;
begin
  for r in select distinct category from questions where set_id is null loop
    insert into question_sets(category, title, emoji, description)
    values (r.category, r.category || ' 모음집', '⚖️', '기존에 등록된 문제들을 모은 기본 문제집이에요.')
    returning id into v_set_id;

    update questions set set_id = v_set_id
    where category = r.category and set_id is null;
  end loop;
end $$;
