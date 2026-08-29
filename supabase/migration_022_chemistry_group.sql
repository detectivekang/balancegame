-- ============================================================================
-- 마이그레이션 022: 궁합 테스트 "그룹 순위" (단톡방 궁합)
--
-- 지금까지는 궁합 테스트 응답(chemistry_matches)을 "초대한 사람"과 "응답한
-- 본인"만 볼 수 있었음 - 그래서 단톡방에 링크 하나를 뿌려서 여러 명이 풀어도
-- 서로 몇 %가 나왔는지 볼 방법이 없었음(각자 자기 결과만 봄).
--
-- 이번 변경: 같은 초대(chemistry_result_id)에 이미 응답을 남긴 사람이라면,
-- 그 초대에 대한 다른 사람들의 응답도 볼 수 있게 함 -> "우리 중 누가 나랑
-- 제일 잘 맞는지" 그룹 순위를 보여줄 수 있게 됨.
-- (내가 먼저 풀어야만 다른 사람 순위가 보이는 구조라 "일단 풀어보고 싶게" 만드는
--  효과도 있음)
--
-- Supabase 대시보드 > SQL Editor 에서 이 파일 전체를 붙여넣고 실행하세요.
-- (migration_021까지 실행한 프로젝트 기준)
-- ============================================================================

create policy "respondents can view the group leaderboard for an invite they took"
  on chemistry_matches for select
  using (
    exists (
      select 1 from chemistry_matches m2
      where m2.chemistry_result_id = chemistry_matches.chemistry_result_id
        and m2.respondent_user_id = auth.uid()
    )
  );
