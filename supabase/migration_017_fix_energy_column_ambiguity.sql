-- ============================================================================
-- 마이그레이션 017: 출석 보상(claim_streak_bonus) / 광고 보상(claim_ad_energy)
--                    함수의 "energy" 컬럼 모호성 버그 수정
--
-- 버그: 두 함수 모두 RETURNS TABLE(energy int, cap int, ...)로 반환값을
--       정의하는데, 이게 "energy"라는 이름의 OUT 변수를 함수 안에 암묵적으로
--       만든다. 그런데 profiles 테이블에도 같은 이름의 컬럼(energy)이 있어서,
--       "select xp, energy into ... from profiles ..." 처럼 테이블 별칭 없이
--       energy를 그냥 쓰면 "컬럼이냐 OUT변수냐" 모호해져서 PL/pgSQL이 예외를
--       던짐 (42702, "column reference energy is ambiguous").
--       cast_vote()의 votes_a/votes_b 버그(migration_014)와 완전히 같은 종류.
--
-- 수정: profiles 조회 시 테이블 별칭(p)을 붙여 p.energy로 명확히 구분.
--
-- Supabase 대시보드 > SQL Editor 에서 이 파일 전체를 붙여넣고 실행하세요.
-- (migration_016까지 실행한 프로젝트 기준)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- claim_streak_bonus: 출석 스트릭 보너스
-- ----------------------------------------------------------------------------
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
    select
      date,
      current_date - date as gap,
      row_number() over (order by date desc) - 1 as rn
    from daily_active
    where user_id = v_user_id and date <= current_date
  ) t
  where t.gap = t.rn;

  if v_streak < p_milestone then
    raise exception 'streak not reached';
  end if;

  insert into streak_bonus_claims(user_id, milestone) values (v_user_id, p_milestone);
  -- 이미 받은 마일스톤이면 primary key 위반으로 여기서 예외 발생 -> 중복 지급 방지

  -- 버그 수정: energy가 OUT 변수명과 겹쳐서 모호했던 부분을 p.energy로 명확히 함
  select p.xp, p.energy into v_xp, v_cur_energy from profiles p where p.id = v_user_id for update;
  v_level := level_for_xp(v_xp);
  v_cap := v_level + 9; -- migration_011 기준 (레벨+4 -> 레벨+9)

  update profiles set energy = least(v_cap, v_cur_energy + v_reward) where id = v_user_id;

  return query select p.energy, v_cap from profiles p where p.id = v_user_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- claim_ad_energy: 리워드 광고 시청 보너스
-- ----------------------------------------------------------------------------
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

  -- 버그 수정: energy가 OUT 변수명과 겹쳐서 모호했던 부분을 p.energy로 명확히 함
  select p.xp, p.energy, p.ad_bonus_date, p.ad_bonus_count
    into v_xp, v_cur_energy, v_ad_date, v_ad_count
    from profiles p where p.id = v_user_id for update;

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
