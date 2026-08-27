-- ============================================================================
-- 마이그레이션 012: 친구 취향 궁합(케미) 테스트
--
-- 문제집을 다 풀면 그 결과(문제별 선택)를 저장해서 공유 링크를 만들고,
-- 친구가 그 링크로 들어와 같은 문제집을 풀면 답이 얼마나 겹치는지 %로 보여줌.
--
-- 개인정보 걱정 없음: 저장되는 건 "어느 문제에서 A/B 뭘 골랐는지"뿐이고
-- 링크 자체가 공유 목적이라 누구나 읽을 수 있게 열어둠 (RLS select: true).
--
-- Supabase 대시보드 > SQL Editor 에서 이 파일 전체를 붙여넣고 실행하세요.
-- ============================================================================

create table chemistry_results (
  id uuid primary key default gen_random_uuid(),
  set_id uuid references question_sets(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  nickname_snapshot text, -- 링크 생성 당시 닉네임 (나중에 닉네임이 바뀌어도 초대 문구는 그대로 보이게)
  answers jsonb not null, -- [{ "question_id": "...", "choice": "A" }, ...]
  created_at timestamptz not null default now()
);

alter table chemistry_results enable row level security;

create policy "chemistry results are viewable by anyone with the link"
  on chemistry_results for select
  using (true);

create policy "logged in users can create their own chemistry result"
  on chemistry_results for insert
  with check (auth.uid() is not null and (user_id is null or user_id = auth.uid()));

create index chemistry_results_set_id_idx on chemistry_results(set_id);
