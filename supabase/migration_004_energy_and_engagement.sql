-- ============================================================================
-- 마이그레이션 004: 에너지 시스템 개편 + 참여 유도 보상
-- Supabase 대시보드 > SQL Editor 에서 이 파일 전체를 붙여넣고 실행하세요.
-- (schema.sql, migration_002, migration_003을 먼저 실행한 프로젝트에 적용)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. 자연 회복 속도: 30분당 1 -> 5분당 1
--    cast_vote() 함수를 새 회복 주기로 재정의 (로직은 기존과 동일, v_elapsed_min 나누는 값만 변경)
-- ----------------------------------------------------------------------------
create or replace function cast_vote(p_question_id uuid, p_choice text)
returns table(votes_a int, votes_b int, xp int, energy int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_category text;
  v_status text;
  v_cur_xp int;
  v_cur_energy int;
  v_updated_at timestamptz;
  v_level int;
  v_cap int;
  v_elapsed_min numeric;
  v_regen int;
  v_new_energy int;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;
  if p_choice not in ('A', 'B') then
    raise exception 'invalid choice';
  end if;

  select category, status into v_category, v_status from questions where id = p_question_id;
  if v_category is null or v_status <> 'approved' then
    raise exception 'question not available';
  end if;

  select p.xp, p.energy, p.energy_updated_at
    into v_cur_xp, v_cur_energy, v_updated_at
    from profiles p
    where p.id = v_user_id
    for update;

  v_level := level_for_xp(v_cur_xp);
  v_cap := v_level + 4;
  v_elapsed_min := extract(epoch from (now() - v_updated_at)) / 60;
  v_regen := floor(v_elapsed_min / 5); -- 30분 -> 5분으로 단축
  v_new_energy := least(v_cap, v_cur_energy + v_regen);

  if v_new_energy <= 0 then
    raise exception 'not enough energy';
  end if;

  insert into votes(user_id, question_id, choice, category)
  values (v_user_id, p_question_id, p_choice, v_category);

  if p_choice = 'A' then
    update questions set votes_a = votes_a + 1 where id = p_question_id;
  else
    update questions set votes_b = votes_b + 1 where id = p_question_id;
  end if;

  insert into xp_events(user_id, amount, type, category)
  values (v_user_id, 1, 'vote', v_category);

  update profiles
  set xp = v_cur_xp + 1,
      energy = v_new_energy - 1,
      energy_updated_at = case when v_regen > 0 then now() else energy_updated_at end
  where id = v_user_id;

  return query
    select q.votes_a, q.votes_b, p.xp, p.energy
    from questions q, profiles p
    where q.id = p_question_id and p.id = v_user_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. 리워드 광고 시청 / 출석 스트릭 보너스로 에너지를 지급하는 함수
--    악용 방지를 위해 서버에서 하루 한도와 스트릭 조건을 직접 검증함.
-- ----------------------------------------------------------------------------
alter table profiles add column ad_bonus_date date;
alter table profiles add column ad_bonus_count int not null default 0;

create table streak_bonus_claims (
  user_id uuid not null references profiles(id) on delete cascade,
  milestone int not null,
  claimed_at timestamptz not null default now(),
  primary key (user_id, milestone)
);

alter table streak_bonus_claims enable row level security;

create policy "users can view own streak claims"
  on streak_bonus_claims for select
  using (user_id = auth.uid());

-- 하루 최대 리워드 광고 시청 횟수 / 회당 지급 에너지
-- (실제 광고 SDK 콜백에서 광고 시청이 끝난 뒤에만 이 함수를 호출해야 함 - 프론트 주석 참고)
create or replace function claim_ad_energy()
returns table(energy int, cap int, remaining_today int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_xp int;
  v_cur_energy int;
  v_level int;
  v_cap int;
  v_ad_date date;
  v_ad_count int;
  v_daily_limit int := 5;
  v_reward int := 3;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  select xp, energy, ad_bonus_date, ad_bonus_count
    into v_xp, v_cur_energy, v_ad_date, v_ad_count
    from profiles where id = v_user_id for update;

  if v_ad_date is distinct from current_date then
    v_ad_date := current_date;
    v_ad_count := 0;
  end if;

  if v_ad_count >= v_daily_limit then
    raise exception 'ad limit reached';
  end if;

  v_level := level_for_xp(v_xp);
  v_cap := v_level + 4;

  update profiles
  set energy = least(v_cap, v_cur_energy + v_reward),
      ad_bonus_date = v_ad_date,
      ad_bonus_count = v_ad_count + 1
  where id = v_user_id;

  return query
    select p.energy, v_cap, v_daily_limit - (v_ad_count + 1)
    from profiles p where p.id = v_user_id;
end;
$$;

grant execute on function claim_ad_energy() to authenticated;

-- 출석 스트릭 마일스톤 보너스 (3/7/14/30일) - 마일스톤당 평생 1회만 지급
create or replace function claim_streak_bonus(p_milestone int)
returns table(energy int, cap int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_xp int;
  v_cur_energy int;
  v_level int;
  v_cap int;
  v_reward int;
  v_streak int;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;
  if p_milestone not in (3, 7, 14, 30) then
    raise exception 'invalid milestone';
  end if;

  v_reward := case p_milestone
    when 3 then 2
    when 7 then 5
    when 14 then 8
    when 30 then 15
  end;

  -- 오늘부터 거슬러 올라가며 daily_active에 연속 기록이 있는지 서버에서 직접 검증
  select count(*) into v_streak
  from (
    select date, current_date - (date) as gap
    from daily_active
    where user_id = v_user_id and date <= current_date
    order by date desc
  ) t
  where t.gap = (row_number() over () - 1);

  if v_streak < p_milestone then
    raise exception 'streak not reached';
  end if;

  insert into streak_bonus_claims(user_id, milestone) values (v_user_id, p_milestone);
  -- 이미 받은 마일스톤이면 primary key 위반으로 여기서 예외 발생 -> 중복 지급 방지

  select xp, energy into v_xp, v_cur_energy from profiles where id = v_user_id for update;
  v_level := level_for_xp(v_xp);
  v_cap := v_level + 4;

  update profiles set energy = least(v_cap, v_cur_energy + v_reward) where id = v_user_id;

  return query select p.energy, v_cap from profiles p where p.id = v_user_id;
end;
$$;

grant execute on function claim_streak_bonus(int) to authenticated;
