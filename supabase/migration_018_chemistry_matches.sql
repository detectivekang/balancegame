-- ============================================================================
-- 마이그레이션 018: 궁합 테스트 결과를 "초대한 사람"도 볼 수 있게 저장
--
-- 지금까지는 친구가 초대 링크로 들어와 궁합 테스트를 풀면 그 결과(% 매칭)가
-- 그 친구 화면에만 잠깐 보이고 사라졌음 - 정작 링크를 만든(초대한) 사람은
-- 누가 풀었는지, 결과가 어땠는지 전혀 알 방법이 없었음.
--
-- chemistry_matches 테이블을 새로 만들어서, 친구가 테스트를 마칠 때마다
-- (초대 결과 id, 응답자, 매칭 개수/percent)를 저장하고, 마이페이지에서
-- "내가 만든 궁합 테스트" 목록에 응답 목록으로 보여줌.
--
-- Supabase 대시보드 > SQL Editor 에서 이 파일 전체를 붙여넣고 실행하세요.
-- ============================================================================

create table chemistry_matches (
  id uuid primary key default gen_random_uuid(),
  chemistry_result_id uuid not null references chemistry_results(id) on delete cascade,
  respondent_user_id uuid references profiles(id) on delete set null,
  respondent_nickname text,
  matched int not null,
  total int not null,
  percent int not null,
  created_at timestamptz not null default now()
);

alter table chemistry_matches enable row level security;

-- 초대를 만든 사람(chemistry_results.user_id) 또는 응답한 본인만 조회 가능
create policy "inviter or respondent can view chemistry match"
  on chemistry_matches for select
  using (
    respondent_user_id = auth.uid()
    or exists (
      select 1 from chemistry_results cr
      where cr.id = chemistry_result_id and cr.user_id = auth.uid()
    )
  );

-- 로그인한 사람은 자기 응답 결과만 기록 가능 (한 초대에 여러 명이 풀 수 있으므로 중복 제한 없음)
create policy "logged in users can record their own chemistry match"
  on chemistry_matches for insert
  with check (auth.uid() is not null and (respondent_user_id is null or respondent_user_id = auth.uid()));

create index chemistry_matches_result_id_idx on chemistry_matches(chemistry_result_id);
