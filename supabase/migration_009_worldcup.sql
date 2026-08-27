-- ============================================================================
-- 마이그레이션 009: 이상형 월드컵
-- Supabase 대시보드 > SQL Editor 에서 이 파일 전체를 붙여넣고 실행하세요.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. worldcups: 월드컵 한 판 (예: "2026 신곡 이상형 월드컵")
--    이미지가 여러 장 들어가는 콘텐츠라 문제(questions)와 달리 월드컵 전체를
--    통으로 승인 대기시킴 (부적절한 이미지 유통을 막기 위해 기본은 관리자 승인 필요).
-- ----------------------------------------------------------------------------
create table worldcups (
  id uuid primary key default gen_random_uuid(),
  category text not null, -- 애니 / 아이돌 / 배우 / 게임 / 상황 등
  title text not null check (char_length(title) between 1 and 40),
  description text,
  creator_id uuid references profiles(id) on delete set null,
  status text not null default 'pending', -- 'pending' | 'approved'
  created_at timestamptz not null default now()
);

alter table worldcups enable row level security;

create policy "approved worldcups are viewable by everyone"
  on worldcups for select
  using (status = 'approved' or creator_id = auth.uid() or is_admin());

create policy "logged in users can create worldcups"
  on worldcups for insert
  with check (auth.uid() is not null and creator_id = auth.uid());

create policy "admin can update worldcups"
  on worldcups for update
  using (is_admin());

create policy "admin or creator can delete their pending worldcup"
  on worldcups for delete
  using (is_admin() or (creator_id = auth.uid() and status = 'pending'));

-- ----------------------------------------------------------------------------
-- 2. worldcup_items: 월드컵 안의 후보 이미지 한 장
--    win_count/match_count/champion_count는 클라이언트가 직접 못 건드리고
--    아래 record_worldcup_match()/record_worldcup_champion() 함수로만 증가함.
-- ----------------------------------------------------------------------------
create table worldcup_items (
  id uuid primary key default gen_random_uuid(),
  worldcup_id uuid not null references worldcups(id) on delete cascade,
  label text not null,
  image_url text not null,
  win_count int not null default 0,
  match_count int not null default 0,
  champion_count int not null default 0,
  created_at timestamptz not null default now()
);

alter table worldcup_items enable row level security;

create policy "items of viewable worldcups are viewable"
  on worldcup_items for select
  using (
    exists (
      select 1 from worldcups w
      where w.id = worldcup_id
        and (w.status = 'approved' or w.creator_id = auth.uid() or is_admin())
    )
  );

create policy "creator can add items to their own worldcup"
  on worldcup_items for insert
  with check (
    exists (
      select 1 from worldcups w
      where w.id = worldcup_id and w.creator_id = auth.uid()
    )
  );

create policy "admin can delete worldcup items"
  on worldcup_items for delete
  using (is_admin());

create index worldcup_items_worldcup_id_idx on worldcup_items(worldcup_id);

-- ----------------------------------------------------------------------------
-- 3. 매치 결과 기록 - 이긴 쪽 win_count/match_count, 진 쪽 match_count만 증가.
--    두 아이템이 같은 월드컵 소속인지 서버에서 검증해서 조작 방지.
-- ----------------------------------------------------------------------------
create or replace function record_worldcup_match(p_winner_id uuid, p_loser_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_winner_wc uuid;
  v_loser_wc uuid;
begin
  select worldcup_id into v_winner_wc from worldcup_items where id = p_winner_id;
  select worldcup_id into v_loser_wc from worldcup_items where id = p_loser_id;

  if v_winner_wc is null or v_loser_wc is null or v_winner_wc <> v_loser_wc then
    raise exception 'invalid match';
  end if;

  update worldcup_items set win_count = win_count + 1, match_count = match_count + 1
  where id = p_winner_id;
  update worldcup_items set match_count = match_count + 1
  where id = p_loser_id;
end;
$$;

grant execute on function record_worldcup_match(uuid, uuid) to authenticated;

-- 최종 우승 시 champion_count +1 (역대 우승 랭킹용)
create or replace function record_worldcup_champion(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update worldcup_items set champion_count = champion_count + 1 where id = p_item_id;
end;
$$;

grant execute on function record_worldcup_champion(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 4. 관리자가 월드컵을 승인하면 제작자에게 보너스 XP 지급 (문제 승인과 동일한 패턴)
-- ----------------------------------------------------------------------------
create or replace function approve_worldcup(p_worldcup_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creator uuid;
begin
  if not is_admin() then
    raise exception 'admin only';
  end if;

  select creator_id into v_creator from worldcups where id = p_worldcup_id;

  update worldcups set status = 'approved' where id = p_worldcup_id;

  if v_creator is not null then
    update profiles set xp = xp + 10 where id = v_creator;
    insert into xp_events(user_id, amount, type, category)
    values (v_creator, 10, 'worldcup_approval', 'worldcup');
  end if;
end;
$$;

grant execute on function approve_worldcup(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 5. Storage 버킷: 월드컵 이미지 저장용 (공개 읽기)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('worldcup-images', 'worldcup-images', true)
on conflict (id) do nothing;

create policy "worldcup images are publicly viewable"
  on storage.objects for select
  using (bucket_id = 'worldcup-images');

create policy "authenticated users can upload worldcup images"
  on storage.objects for insert
  with check (bucket_id = 'worldcup-images' and auth.uid() is not null);

create policy "owners or admin can delete worldcup images"
  on storage.objects for delete
  using (bucket_id = 'worldcup-images' and (owner = auth.uid() or is_admin()));

create index worldcups_status_category_idx on worldcups(status, category);
