-- ============================================================================
-- migration_020_worldcup_results.sql (재실행 안전 버전)
--
-- 이미 테이블/정책이 일부 만들어져 있어도 오류 없이 다시 실행할 수 있게
-- "이미 있으면 건너뛰기" 방식으로 바꾼 버전. 원본과 결과는 동일함.
-- ============================================================================

create table if not exists worldcup_results (
  id uuid primary key default gen_random_uuid(),
  worldcup_id uuid not null references worldcups(id) on delete cascade,
  champion_item_id uuid not null references worldcup_items(id) on delete cascade,
  round_size int not null,
  sharer_id uuid references profiles(id) on delete set null,
  sharer_nickname_snapshot text,
  created_at timestamptz not null default now()
);

alter table worldcup_results enable row level security;

drop policy if exists "worldcup results are viewable by anyone with the link" on worldcup_results;
create policy "worldcup results are viewable by anyone with the link"
  on worldcup_results for select
  using (true);

drop policy if exists "logged in users can create their own worldcup result" on worldcup_results;
create policy "logged in users can create their own worldcup result"
  on worldcup_results for insert
  with check (auth.uid() is not null and (sharer_id is null or sharer_id = auth.uid()));

create index if not exists worldcup_results_worldcup_id_idx on worldcup_results(worldcup_id);
