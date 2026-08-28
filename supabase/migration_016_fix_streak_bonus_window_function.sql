-- ============================================================================
-- 마이그레이션 016: 출석 스트릭 보너스(claim_streak_bonus) 오류 수정
--
-- 버그: 연속 출석일을 계산하는 서브쿼리에서 row_number() 윈도우 함수를
--       WHERE 절에 직접 사용하고 있었음 (PostgreSQL 문법상 불가능,
--       "window functions are not allowed in WHERE" / 42P20).
--       처음 만들어질 때부터 있던 버그로, 실제로 3일 연속 출석 보너스를
--       눌러본 게 이번이 처음이라 이제야 발견됨.
--
-- 수정: row_number()를 먼저 서브쿼리의 SELECT 절에서 계산해 컬럼으로
--       만들고, 바깥 쿼리의 WHERE에서 그 컬럼을 사용하도록 변경.
--
-- Supabase 대시보드 > SQL Editor 에서 이 파일 전체를 붙여넣고 실행하세요.
-- (migration_011까지 실행한 프로젝트 기준)
-- ============================================================================

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
  -- (row_number()는 서브쿼리 안에서 컬럼으로 미리 계산해야 WHERE에서 쓸 수 있음)
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

  select xp, energy into v_xp, v_cur_energy from profiles where id = v_user_id for update;
  v_level := level_for_xp(v_xp);
  v_cap := v_level + 9; -- migration_011 기준 (레벨+4 -> 레벨+9)

  update profiles set energy = least(v_cap, v_cur_energy + v_reward) where id = v_user_id;

  return query select p.energy, v_cap from profiles p where p.id = v_user_id;
end;
$$;
