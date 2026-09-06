-- ============================================================================
-- 마이그레이션 025: 관리자의 월드컵 후보(사진/이름) 수정 허용
-- Supabase 대시보드 > SQL Editor 에서 이 파일 전체를 붙여넣고 실행하세요.
--
-- 왜 필요한가:
--   migration_009_worldcup.sql 에는 worldcup_items에 대해 select/insert(제작자만)/
--   delete(관리자만) 정책만 있고 update 정책이 없어서, 관리자도 이미 등록된 후보의
--   사진(image_url)이나 이름(label)을 수정할 수 없었음 (RLS가 기본적으로 막음).
--   이 마이그레이션은 관리자가 사진 교체/이름 수정/후보 추가를 할 수 있도록
--   update 정책과, 관리자용 insert 정책을 추가함.
-- ============================================================================

create policy "admin can update worldcup items"
  on worldcup_items for update
  using (is_admin())
  with check (is_admin());

create policy "admin can insert worldcup items"
  on worldcup_items for insert
  with check (is_admin());
