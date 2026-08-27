-- ============================================================================
-- 마이그레이션 011: 초반 에너지 캡 상향 (레벨+4 → 레벨+9, Lv.1 기준 5 → 10)
--
-- 이유: 월드컵 입장료(5)와 Lv.1 캡(5)이 같아서 레벨1 유저는 월드컵 한 번 하면
--       밸런스게임 포함 아무것도 더 못 하는 상태가 됐음. 캡을 올려서 여유를 줌.
--
-- cap을 계산하는 4개 함수(cast_vote, claim_ad_energy, claim_streak_bonus,
-- start_worldcup) 전부 같은 공식을 쓰도록 한 번에 재정의함.
--
-- Supabase 대시보드 > SQL Editor 에서 이 파일 전체를 붙여넣고 실행하세요.
-- (migration_008, migration_010까지 실행한 프로젝트 기준)
-- ============================================================================

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
  v_is_premium boolean;
  v_premium_until timestamptz;
  v_premium_active boolean;
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

  select p.xp, p.energy, p.energy_updated_at, p.is_premium, p.premium_until
    into v_cur_xp, v_cur_energy, v_updated_at, v_is_premium, v_premium_until
    from profiles p
    where p.id = v_user_id
    for update;

  v_premium_active := coalesce(v_is_premium, false)
    and (v_premium_until is null or v_premium_until > now());

  v_level := level_for_xp(v_cur_xp);
  v_cap := v_level + 9; -- 레벨+4 -> 레벨+9 (Lv.1 캡 10)
  v_elapsed_min := extract(epoch from (now() - v_updated_at)) / 60;
  v_regen := floor(v_elapsed_min / 5);
  v_new_energy := least(v_cap, v_cur_energy + v_regen);

  if not v_premium_active and v_new_energy <= 0 then
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

  if v_premium_active then
    update profiles set xp = v_cur_xp + 1 where id = v_user_id;
  else
    update profiles
    set xp = v_cur_xp + 1,
        energy = v_new_energy - 1,
        energy_updated_at = case when v_regen > 0 then now() else energy_updated_at end
    where id = v_user_id;
  end if;

  return query
    select q.votes_a, q.votes_b, p.xp, p.energy
    from questions q, profiles p
    where q.id = p_question_id and p.id = v_user_id;
end;
$$;

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
  v_cap := v_level + 9; -- 레벨+4 -> 레벨+9

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

  select xp, energy into v_xp, v_cur_energy from profiles where id = v_user_id for update;
  v_level := level_for_xp(v_xp);
  v_cap := v_level + 9; -- 레벨+4 -> 레벨+9

  update profiles set energy = least(v_cap, v_cur_energy + v_reward) where id = v_user_id;

  return query select p.energy, v_cap from profiles p where p.id = v_user_id;
end;
$$;

create or replace function start_worldcup(p_cost int default 5)
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
  v_cap := v_level + 9; -- 레벨+4 -> 레벨+9
  v_elapsed_min := extract(epoch from (now() - v_updated_at)) / 60;
  v_regen := floor(v_elapsed_min / 5);
  v_new_energy := least(v_cap, v_cur_energy + v_regen);

  if v_premium_active then
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

  return query select p.energy, v_cap from profiles p where p.id = v_user_id;
end;
$$;
