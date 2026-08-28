-- ============================================================================
-- 마이그레이션 014: 투표(cast_vote) 컬럼 모호성 버그 + 출석(daily_active) RLS 누락 수정
--
-- 버그 1) daily_active: INSERT/SELECT(admin) 정책만 있고 UPDATE 정책이 없어서,
--         이미 오늘 기록이 있는 상태로 다시 upsert(on_conflict=user_id,date)를
--         호출하면 PostgREST가 내부적으로 INSERT ... ON CONFLICT DO UPDATE를
--         실행하는데 UPDATE 정책이 없어 RLS에 막힘 (42501).
--
-- 버그 2) cast_vote: RETURNS TABLE(votes_a int, votes_b int, ...)가 만드는
--         OUT 변수 votes_a/votes_b가 questions 테이블의 동명 컬럼과 이름이
--         겹쳐서, "update questions set votes_a = votes_a + 1 ..."의 우변이
--         모호해짐 (42702, "column reference votes_b is ambiguous").
--         테이블 별칭(q)으로 명확히 구분해서 해결.
--
-- Supabase 대시보드 > SQL Editor 에서 이 파일 전체를 붙여넣고 실행하세요.
-- (migration_011까지 실행한 프로젝트 기준)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 버그 1 수정: daily_active UPDATE 정책 추가
-- ----------------------------------------------------------------------------
create policy "users can update own daily activity"
  on daily_active for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 버그 2 수정: cast_vote 함수 재정의 (컬럼 참조를 테이블 별칭으로 명확화)
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

  -- 버그 수정: votes_a / votes_b 가 RETURNS TABLE의 OUT 변수명과 겹쳐서
  -- 모호했던 부분을 테이블 별칭(q)으로 명확히 구분함.
  if p_choice = 'A' then
    update questions q set votes_a = q.votes_a + 1 where q.id = p_question_id;
  else
    update questions q set votes_b = q.votes_b + 1 where q.id = p_question_id;
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
