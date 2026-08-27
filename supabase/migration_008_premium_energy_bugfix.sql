-- ============================================================================
-- 마이그레이션 008: 버그 수정 - cast_vote가 무제한 이용권(프리미엄)을 무시하던 문제
--
-- 증상: 관리자가 "무제한 이용권"을 부여해도(is_premium=true) 화면엔 "무제한"으로
--       뜨지만, 실제 문제 풀기(cast_vote)는 여전히 실제 energy 컬럼을 깎고
--       0이 되면 "에너지가 부족해요" 에러가 나서 실질적으로 막혀있었음.
--
-- 원인: is_premium 컬럼(마이그레이션 005)이 cast_vote 함수(마이그레이션 004)보다
--       나중에 추가됐는데, cast_vote 함수 자체가 그 이후 업데이트되지 않아서
--       프리미엄 여부를 전혀 확인하지 않고 있었음.
--
-- Supabase 대시보드 > SQL Editor 에서 이 파일 전체를 붙여넣고 실행하세요.
-- (migration_005까지 실행한 프로젝트 기준)
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

  -- 무제한 이용권 활성 여부: is_premium=true 이고, premium_until이 없거나(무기한) 아직 안 지났으면 유효
  v_premium_active := coalesce(v_is_premium, false)
    and (v_premium_until is null or v_premium_until > now());

  v_level := level_for_xp(v_cur_xp);
  v_cap := v_level + 4;
  v_elapsed_min := extract(epoch from (now() - v_updated_at)) / 60;
  v_regen := floor(v_elapsed_min / 5);
  v_new_energy := least(v_cap, v_cur_energy + v_regen);

  -- 프리미엄이 아닐 때만 에너지 체크
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
    -- 프리미엄은 에너지를 아예 소모하지 않음 (실제 energy 컬럼 값은 그대로 둠 -
    -- 화면은 항상 "가득 참"으로 클라이언트가 계산해서 보여줌)
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
