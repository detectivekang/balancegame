-- ============================================================================
-- 마이그레이션 023: 실시간 인기 랭킹 ("지금 뜨는" / "이번 주 인기")
--
-- 기존 "BEST" 섹션은 전체 누적 기준이라 오래되고 표가 많이 쌓인 콘텐츠만 계속
-- 상위에 남는 문제가 있었음(신선함이 없음). 이번엔 "최근 24시간/7일" 활동량
-- 기준의 트렌딩 랭킹을 따로 추가함.
--
-- 1) 밸런스게임 문제집: votes 테이블에 이미 있는 created_at을 그대로 씀.
--    단, votes는 RLS로 본인 투표만 조회 가능해서, 집계만 반환하는
--    security definer 함수(trending_deck_ids)를 통해서만 접근 가능하게 함
--    (개별 유저의 투표 내역은 여전히 노출 안 됨 - 집계 수치만 나감).
--
-- 2) 이상형 월드컵: 지금까지는 "언제 플레이됐는지"를 전혀 기록 안 하고 있어서
--    (누적 win_count/match_count만 있음) worldcup_plays 테이블을 새로 만들어서
--    월드컵 입장(=start_worldcup 호출)마다 한 줄씩 기록함. 누가 했는지는 저장하지
--    않고 "언제, 어떤 월드컵"만 기록 (개인정보 최소화).
--
-- Supabase 대시보드 > SQL Editor 에서 이 파일 전체를 붙여넣고 실행하세요.
-- (migration_022까지 실행한 프로젝트 기준)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. 월드컵 플레이 기록 (트렌딩 집계 전용 - 개인 식별 정보 없음)
-- ----------------------------------------------------------------------------
create table worldcup_plays (
  id uuid primary key default gen_random_uuid(),
  worldcup_id uuid not null references worldcups(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table worldcup_plays enable row level security;

-- 집계용 데이터라 누구나 조회 가능하게 둠 (개인 식별 정보가 없어서 안전함)
create policy "worldcup play timestamps are viewable by everyone"
  on worldcup_plays for select
  using (true);

-- insert 정책은 일부러 안 만듦 - start_worldcup()(security definer)을 통해서만 기록되게 함
-- (votes 테이블이 cast_vote()를 통해서만 쓰이는 것과 같은 패턴)

create index worldcup_plays_worldcup_id_created_idx on worldcup_plays(worldcup_id, created_at);

-- ----------------------------------------------------------------------------
-- 2. start_worldcup에 p_worldcup_id 파라미터 추가 + 플레이 기록 남기기
--    (기존 로직은 그대로 두고 로깅만 추가함)
-- ----------------------------------------------------------------------------
create or replace function start_worldcup(p_cost int default 5, p_worldcup_id uuid default null)
returns table(energy int, cap int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_cur_xp int;
  v_cur_energy int;
  v_updated_at timestamptz;
  v_level int;
  v_cap int;
  v_elapsed_min numeric;
  v_regen int;
  v_new_energy int;
  v_is_premium boolean;
  v_premium_until timestamptz;
  v_premium_active boolean;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  select p.xp, p.energy, p.energy_updated_at, p.is_premium, p.premium_until
    into v_cur_xp, v_cur_energy, v_updated_at, v_is_premium, v_premium_until
    from profiles p
    where p.id = v_user_id
    for update;

  v_premium_active := coalesce(v_is_premium, false)
    and (v_premium_until is null or v_premium_until > now());

  v_level := level_for_xp(v_cur_xp);
  v_cap := v_level + 9;
  v_elapsed_min := extract(epoch from (now() - v_updated_at)) / 60;
  v_regen := floor(v_elapsed_min / 5);
  v_new_energy := least(v_cap, v_cur_energy + v_regen);

  if v_premium_active then
    if p_worldcup_id is not null then
      insert into worldcup_plays(worldcup_id) values (p_worldcup_id);
    end if;
    return query select p.energy, v_cap from profiles p where p.id = v_user_id;
    return;
  end if;

  if v_new_energy < p_cost then
    raise exception 'not enough energy';
  end if;

  update profiles
  set energy = v_new_energy - p_cost,
      energy_updated_at = case when v_regen > 0 then now() else energy_updated_at end
  where id = v_user_id;

  if p_worldcup_id is not null then
    insert into worldcup_plays(worldcup_id) values (p_worldcup_id);
  end if;

  return query select p.energy, v_cap from profiles p where p.id = v_user_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. 최근 N시간 투표량 기준 문제집 트렌딩 순위 (집계만 반환, 개인 투표 내역 노출 없음)
-- ----------------------------------------------------------------------------
create or replace function trending_deck_ids(p_hours int default 24, p_limit int default 6)
returns table(set_id uuid, recent_votes bigint)
language sql
security definer
stable
set search_path = public
as $$
  select q.set_id, count(*) as recent_votes
  from votes v
  join questions q on q.id = v.question_id
  where v.created_at > now() - (p_hours || ' hours')::interval
    and q.set_id is not null
  group by q.set_id
  order by recent_votes desc
  limit p_limit;
$$;

grant execute on function trending_deck_ids(int, int) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. 최근 N시간 플레이 수 기준 월드컵 트렌딩 순위
-- ----------------------------------------------------------------------------
create or replace function trending_worldcup_ids(p_hours int default 24, p_limit int default 6)
returns table(worldcup_id uuid, recent_plays bigint)
language sql
security definer
stable
set search_path = public
as $$
  select wp.worldcup_id, count(*) as recent_plays
  from worldcup_plays wp
  where wp.created_at > now() - (p_hours || ' hours')::interval
  group by wp.worldcup_id
  order by recent_plays desc
  limit p_limit;
$$;

grant execute on function trending_worldcup_ids(int, int) to anon, authenticated;
