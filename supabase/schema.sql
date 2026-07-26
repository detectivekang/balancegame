-- ============================================================================
-- 밸런스게임 앱 - Supabase(Postgres) 스키마
-- Supabase 대시보드 > SQL Editor 에서 이 파일 전체를 붙여넣고 실행하세요.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. profiles: 회원가입 정보(닉네임/나이/성별) + 레벨시스템(xp/energy)
--    id는 auth.users.id 를 그대로 사용 (카카오 로그인 / 관리자 이메일 로그인 공용)
-- ----------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 12),
  age int not null check (age between 1 and 110),
  gender text not null check (gender in ('남성', '여성')),
  xp int not null default 0,
  energy int not null default 5,
  energy_updated_at timestamptz not null default now(),
  first_seen_date date not null default current_date,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- 관리자 판별: 이 이메일로 로그인한 세션만 관리자 (이메일/비밀번호 로그인 계정)
create or replace function is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'kangseabich@naver.com';
$$;

-- 닉네임/레벨/XP 등은 명예의 전당·프로필 표시에 필요해서 전체 공개 읽기로 둠
-- (age/gender는 이 앱 성격상 민감도가 낮다고 판단, 필요하면 별도 뷰로 분리 가능)
create policy "profiles are viewable by everyone"
  on profiles for select
  using (true);

-- 본인 프로필은 최초 1회만 생성 가능 (회원가입 = 이 insert 한 번)
create policy "users can insert own profile"
  on profiles for insert
  with check (auth.uid() = id);

-- xp/energy는 아래 cast_vote()/approve_question() 함수(SECURITY DEFINER)를 통해서만 변경됨.
-- 클라이언트가 직접 update 하는 경로는 열어두지 않음(위변조 방지).
create policy "admin can update any profile"
  on profiles for update
  using (is_admin());

create policy "admin can delete profile"
  on profiles for delete
  using (is_admin());

-- ----------------------------------------------------------------------------
-- 2. questions: 밸런스게임 문제
-- ----------------------------------------------------------------------------
create table questions (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  question text not null,
  option_a text not null,
  option_b text not null,
  votes_a int not null default 0,
  votes_b int not null default 0,
  source text not null default 'user', -- 'user' | 'admin_excel'
  submitter_id uuid references profiles(id) on delete set null,
  status text not null default 'pending', -- 'pending' | 'approved'
  created_at timestamptz not null default now()
);

alter table questions enable row level security;

create policy "approved questions are public, admin sees all"
  on questions for select
  using (status = 'approved' or is_admin());

-- 일반 유저는 반드시 status='pending', votes 0으로만 등록 가능(UGC).
-- 관리자는 엑셀 업로드 등으로 status='approved' 로 바로 등록 가능.
create policy "users can submit pending questions, admin can insert any"
  on questions for insert
  with check (
    is_admin()
    or (
      status = 'pending'
      and votes_a = 0
      and votes_b = 0
      and submitter_id = auth.uid()
    )
  );

create policy "only admin can update questions directly"
  on questions for update
  using (is_admin());

create policy "only admin can delete questions"
  on questions for delete
  using (is_admin());

-- ----------------------------------------------------------------------------
-- 3. votes: 플레이어별 투표 기록 (user_id + question_id 유니크 → 중복투표 서버단 방지)
-- ----------------------------------------------------------------------------
create table votes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  choice text not null check (choice in ('A', 'B')),
  category text not null,
  created_at timestamptz not null default now(),
  unique (user_id, question_id)
);

alter table votes enable row level security;

-- 투표는 cast_vote() 함수를 통해서만 생성됨(SECURITY DEFINER, RLS 우회).
-- 클라이언트는 자기 투표 내역만 조회 가능, 관리자는 전체 조회 가능.
create policy "users can view own votes, admin can view all"
  on votes for select
  using (user_id = auth.uid() or is_admin());

-- ----------------------------------------------------------------------------
-- 4. xp_events: 명예의 전당(주간/월간 랭킹) 집계용 경험치 획득 로그
-- ----------------------------------------------------------------------------
create table xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  amount int not null,
  type text not null, -- 'vote' | 'approval'
  category text,
  created_at timestamptz not null default now()
);

alter table xp_events enable row level security;

-- 랭킹 계산을 위해 누구나 읽을 수 있게 공개 (user_id는 무작위 UUID라 저위험)
create policy "xp events are viewable by everyone"
  on xp_events for select
  using (true);

-- ----------------------------------------------------------------------------
-- 5. daily_active: 일일 활성 사용자(DAU) 기록
-- ----------------------------------------------------------------------------
create table daily_active (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  date date not null,
  unique (user_id, date)
);

alter table daily_active enable row level security;

create policy "users can log own daily activity"
  on daily_active for insert
  with check (user_id = auth.uid());

create policy "admin can view daily activity"
  on daily_active for select
  using (is_admin());

-- ----------------------------------------------------------------------------
-- 6. level_for_xp: 레벨 계산 공식 (레벨1→2: 100xp, 레벨2→3: 300xp, 이후 200씩 증가)
--    누적 임계값(레벨 L 도달에 필요한 xp) = 100 * (L-1)^2 의 닫힌 형태(closed form)
-- ----------------------------------------------------------------------------
create or replace function level_for_xp(p_xp int)
returns int
language sql
immutable
as $$
  select least(30, floor(sqrt(greatest(p_xp, 0) / 100.0))::int + 1);
$$;

-- ----------------------------------------------------------------------------
-- 7. cast_vote: 투표 1건을 원자적으로 처리하는 함수
--    - 에너지 확인/차감, 중복투표 방지(unique 제약), 문제 득표수 증가,
--      xp_events 기록, 프로필 xp 증가를 하나의 트랜잭션으로 처리
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
  v_regen := floor(v_elapsed_min / 30);
  v_new_energy := least(v_cap, v_cur_energy + v_regen);

  if v_new_energy <= 0 then
    raise exception 'not enough energy';
  end if;

  -- unique(user_id, question_id) 제약이 중복 투표를 막아줌 (위반 시 예외 발생)
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

grant execute on function cast_vote(uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 8. approve_question: 관리자가 UGC 문제를 승인하면 제출자에게 보너스 XP 지급
-- ----------------------------------------------------------------------------
create or replace function approve_question(p_question_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submitter uuid;
  v_category text;
begin
  if not is_admin() then
    raise exception 'admin only';
  end if;

  select submitter_id, category into v_submitter, v_category
    from questions where id = p_question_id;

  update questions set status = 'approved' where id = p_question_id;

  if v_submitter is not null then
    update profiles set xp = xp + 5 where id = v_submitter;
    insert into xp_events(user_id, amount, type, category)
    values (v_submitter, 5, 'approval', v_category);
  end if;
end;
$$;

grant execute on function approve_question(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 9. 시드 데이터 업로드 스크립트(scripts/seed.js)가 쓰는 인덱스
-- ----------------------------------------------------------------------------
create index questions_status_category_idx on questions(status, category);
create index xp_events_created_at_idx on xp_events(created_at);
create index votes_user_id_idx on votes(user_id);
