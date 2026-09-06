-- ============================================================================
-- 마이그레이션 026: 궁합 테스트 초대 삭제 + 1주일 지난 미응답 초대 자동 정리
-- Supabase 대시보드 > SQL Editor 에서 이 파일 전체를 붙여넣고 실행하세요.
--
-- 배경: chemistry_results(궁합 테스트 초대)는 만들 때마다 계속 쌓이기만 하고
-- 지울 방법이 없어서(delete 정책 자체가 없었음) 마이페이지 목록이 끝없이
-- 길어지는 문제가 있었음. 이 마이그레이션은 두 가지를 추가함:
--   1) 초대를 만든 본인이 직접 삭제할 수 있는 delete 정책
--   2) 만든 지 7일이 지났는데 아직 아무도 안 푼(=매치 기록이 0개인) 초대를
--      자동으로 정리하는 함수 (마이페이지 방문 시 프론트에서 호출)
--
-- 참고: chemistry_matches는 이미 on delete cascade로 걸려 있어서
-- chemistry_results를 지우면 관련 매치 기록도 같이 정리됨.
-- ============================================================================

-- 1) 본인이 만든 궁합 테스트 초대는 본인이 삭제 가능
create policy "creator can delete their own chemistry invite"
  on chemistry_results for delete
  using (user_id = auth.uid());

-- 2) 로그인한 사용자가 자신의 "7일 지났고 아무도 안 푼" 초대를 정리하는 함수.
--    security definer + auth.uid() 스코프라서 본인 것만 지울 수 있음.
create or replace function cleanup_my_stale_chemistry_invites()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from chemistry_results cr
  where cr.user_id = auth.uid()
    and cr.created_at < now() - interval '7 days'
    and not exists (
      select 1 from chemistry_matches cm where cm.chemistry_result_id = cr.id
    );
end;
$$;

grant execute on function cleanup_my_stale_chemistry_invites() to authenticated;

-- ----------------------------------------------------------------------------
-- (선택) 사용자가 마이페이지에 안 들어와도 서버에서 자동으로 매일 정리하고
-- 싶다면, Supabase 대시보드 > Database > Extensions 에서 pg_cron을 켠 뒤
-- 아래 주석을 해제해서 실행하세요. (관리자 권한 함수라 위 함수와는 별도로
-- 전체 사용자 대상으로 도는 버전을 새로 만듦)
-- ----------------------------------------------------------------------------
-- create or replace function cleanup_all_stale_chemistry_invites()
-- returns void
-- language plpgsql
-- security definer
-- set search_path = public
-- as $$
-- begin
--   delete from chemistry_results cr
--   where cr.created_at < now() - interval '7 days'
--     and not exists (
--       select 1 from chemistry_matches cm where cm.chemistry_result_id = cr.id
--     );
-- end;
-- $$;
--
-- select cron.schedule(
--   'cleanup-stale-chemistry-invites',
--   '0 4 * * *', -- 매일 새벽 4시
--   $$ select cleanup_all_stale_chemistry_invites(); $$
-- );
