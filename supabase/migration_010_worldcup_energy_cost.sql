-- ============================================================================
-- 마이그레이션 010: 이상형 월드컵 입장료(에너지 소모)
--
-- 정책: 월드컵은 매치마다가 아니라 "입장할 때 한 번만" 에너지를 소모하고,
--       그 이후로는 몇 강이든 끝까지 자유롭게 플레이할 수 있음.
--       무제한 이용권(프리미엄) 유저는 소모 없이 무료.
--
-- Supabase 대시보드 > SQL Editor 에서 이 파일 전체를 붙여넣고 실행하세요.
-- (migration_005 premium, migration_008 premium bugfix까지 실행한 프로젝트 기준)
-- ============================================================================

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
  v_cap := v_level + 4;
  v_elapsed_min := extract(epoch from (now() - v_updated_at)) / 60;
  v_regen := floor(v_elapsed_min / 5);
  v_new_energy := least(v_cap, v_cur_energy + v_regen);

  if v_premium_active then
    -- 프리미엄은 무료 입장 (energy 컬럼은 건드리지 않음)
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

grant execute on function start_worldcup(int) to authenticated;
