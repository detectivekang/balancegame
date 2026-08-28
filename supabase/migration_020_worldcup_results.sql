-- ============================================================================
-- 마이그레이션 020: 이상형 월드컵 결과를 "링크로 공유"할 수 있게 함
--
-- 지금까지는 우승 결과를 PNG 이미지 한 장으로만 공유할 수 있었음 - 받는 사람은
-- 예쁜 이미지를 보긴 하지만 클릭해서 자기도 해볼 수 있는 통로가 없었음.
--
-- worldcup_results 테이블을 새로 만들어서 "누가, 어떤 월드컵을, 몇 강으로 해서,
-- 누가 우승했는지"를 저장하고, 그 결과를 보여주는 공개 페이지(로그인 불필요)와
-- 거기서 바로 "나도 도전하기"로 이어지는 링크를 만듦.
--
-- Supabase 대시보드 > SQL Editor 에서 이 파일 전체를 붙여넣고 실행하세요.
-- ============================================================================

create table worldcup_results (
  id uuid primary key default gen_random_uuid(),
  worldcup_id uuid not null references worldcups(id) on delete cascade,
  champion_item_id uuid not null references worldcup_items(id) on delete cascade,
  round_size int not null,
  sharer_id uuid references profiles(id) on delete set null,
  sharer_nickname_snapshot text, -- 공유 당시 닉네임 스냅샷 (나중에 닉네임이 바뀌어도 카드 문구는 그대로)
  created_at timestamptz not null default now()
);

alter table worldcup_results enable row level security;

-- 링크만 있으면 누구나(비로그인 포함) 결과 카드를 볼 수 있어야 함
create policy "worldcup results are viewable by anyone with the link"
  on worldcup_results for select
  using (true);

create policy "logged in users can create their own worldcup result"
  on worldcup_results for insert
  with check (auth.uid() is not null and (sharer_id is null or sharer_id = auth.uid()));

create index worldcup_results_worldcup_id_idx on worldcup_results(worldcup_id);
