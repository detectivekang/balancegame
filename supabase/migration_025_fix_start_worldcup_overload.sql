-- ============================================================================
-- 마이그레이션 025: start_worldcup 중복 함수 정리 (월드컵 입장 오류 수정)
--
-- 문제: migration_023에서 start_worldcup에 p_worldcup_id 파라미터를 추가했는데,
-- Postgres 입장에서 파라미터 개수가 다르면 "같은 함수 수정"이 아니라 "새 함수
-- 추가"로 처리됨. 그래서 지금 DB에는:
--   - start_worldcup(p_cost int)                    <- migration_010/011의 옛날 버전
--   - start_worldcup(p_cost int, p_worldcup_id uuid) <- migration_023의 새 버전
-- 이렇게 두 개가 같이 남아있어서, 클라이언트가 호출할 때 어떤 걸 써야 할지
-- 겹쳐서(overload) "입장 처리 중 오류" 가 발생함.
--
-- 이 마이그레이션은 옛날 1개짜리 버전을 명시적으로 지워서 새 버전 하나만
-- 남기고, PostgREST 캐시도 강제로 새로고침시킴.
--
-- Supabase 대시보드 > SQL Editor 에서 이 파일 전체를 붙여넣고 실행하세요.
-- ============================================================================

drop function if exists start_worldcup(int);

-- 혹시 몰라 최신 버전도 다시 한 번 명시적으로 재생성 (내용은 migration_023과 동일)
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

-- PostgREST가 함수 목록을 다시 읽도록 강제로 알림 (보통 자동으로 되지만, 방금
-- 겪은 것처럼 캐시가 꼬였을 때 확실하게 밀어주는 용도)
notify pgrst, 'reload schema';
