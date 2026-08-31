-- ============================================================================
-- 마이그레이션 021: 밸런스게임 결과도 "링크로 공유"할 수 있게 함
--
-- 월드컵(migration_020)과 똑같은 이유 - 지금까지 "결과 공유하기"는 PNG 이미지
-- 한 장만 만들어줘서, 받는 사람이 클릭해서 자기도 해볼 수 있는 통로가 없었음.
--
-- balance_results 테이블을 새로 만들어서 "누가, 어느 문제집에서, 어떤 페르소나가
-- 나왔는지"를 저장하고, 그 결과를 보여주는 공개 페이지(로그인 불필요)와
-- 거기서 바로 "너도 해볼래?"로 이어지는 링크를 만듦.
--
-- Supabase 대시보드 > SQL Editor 에서 이 파일 전체를 붙여넣고 실행하세요.
-- ============================================================================

create table balance_results (
  id uuid primary key default gen_random_uuid(),
  set_id uuid references question_sets(id) on delete cascade,
  category text, -- set_id가 없는 "OO 모음집" 폴백 가상 문제집일 때 사용 (chemistry_results와 동일한 패턴)
  deck_title text not null,
  sharer_nickname_snapshot text,
  persona_label text not null,
  persona_desc text,
  minority_count int not null default 0,
  xp_earned int not null default 0,
  created_at timestamptz not null default now()
);

alter table balance_results enable row level security;

-- 링크만 있으면 누구나(비로그인 포함) 결과 카드를 볼 수 있어야 함
create policy "balance results are viewable by anyone with the link"
  on balance_results for select
  using (true);

create policy "logged in users can create their own balance result"
  on balance_results for insert
  with check (auth.uid() is not null);

create index balance_results_set_id_idx on balance_results(set_id);
