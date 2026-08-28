-- ============================================================================
-- 마이그레이션 020: 이상형 월드컵 임시저장
--
-- 정책: 월드컵을 만드는 도중에 status='draft' 로 저장해두고 나중에 이어서
--       작성할 수 있게 함. 기존에는 관리자만 worldcups/worldcup_items를
--       수정할 수 있었어서, 만드는 사람 본인이 자기 draft를 고치고 지울 수
--       있도록 정책을 추가함. status가 'pending'/'approved'로 넘어간 뒤에는
--       (이미 승인 대기/노출된 콘텐츠이므로) 이 정책들이 적용되지 않음 -
--       즉 제출 후에는 지금처럼 관리자만 만질 수 있음.
--
-- Supabase 대시보드 > SQL Editor 에서 이 파일 전체를 붙여넣고 실행하세요.
-- (migration_009, 010까지 실행한 프로젝트 기준)
-- ============================================================================

-- 1. 본인 draft 월드컵의 제목/카테고리 수정 + draft -> pending 제출 전환 허용
create policy "creator can update their own draft worldcup"
  on worldcups for update
  using (creator_id = auth.uid() and status = 'draft')
  with check (creator_id = auth.uid() and status in ('draft', 'pending'));

-- 2. 기존 삭제 정책은 status='pending'인 것만 본인이 지울 수 있었음.
--    draft도 "새로 시작하기"로 지울 수 있어야 하므로 draft를 포함하도록 교체.
drop policy if exists "admin or creator can delete their pending worldcup" on worldcups;

create policy "admin or creator can delete their draft or pending worldcup"
  on worldcups for delete
  using (is_admin() or (creator_id = auth.uid() and status in ('draft', 'pending')));

-- 3. 본인 draft 월드컵에 속한 항목(이미지/이름) 수정 허용 (라벨 고치기 등)
create policy "creator can update items of their own draft worldcup"
  on worldcup_items for update
  using (
    exists (
      select 1 from worldcups w
      where w.id = worldcup_id and w.creator_id = auth.uid() and w.status = 'draft'
    )
  );

-- 4. 본인 draft 월드컵에 속한 항목 삭제 허용 (후보 이미지 빼기)
create policy "creator can delete items of their own draft worldcup"
  on worldcup_items for delete
  using (
    exists (
      select 1 from worldcups w
      where w.id = worldcup_id and w.creator_id = auth.uid() and w.status = 'draft'
    )
  );
