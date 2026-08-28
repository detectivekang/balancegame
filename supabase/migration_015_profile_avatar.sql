-- ============================================================================
-- 마이그레이션 015: 프로필 아바타(작은 프로필 사진)
--
-- 마이페이지에서 작은 프로필 사진을 올릴 수 있게 하고, 문제집/월드컵 카드의
-- "작성자" 영역(지금은 👤 아이콘만 표시)에 그 사진이 보이도록 함.
--
-- Supabase 대시보드 > SQL Editor 에서 이 파일 전체를 붙여넣고 실행하세요.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. profiles.avatar_url: 프로필 사진 URL
-- ----------------------------------------------------------------------------
alter table profiles add column if not exists avatar_url text;

-- ----------------------------------------------------------------------------
-- 2. Storage 버킷: 프로필 사진 저장용 (공개 읽기)
--    question-set-covers 버킷과 동일한 방식 - 클라이언트에서 아주 작게(128px)
--    리사이즈한 뒤 업로드함.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- 누구나 볼 수 있음 (문제집/월드컵 카드에 작성자 사진으로 표시되므로 공개)
create policy "avatar images are publicly viewable"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- 로그인한 유저는 업로드 가능 (앱에서 리사이즈 후 업로드)
create policy "authenticated users can upload avatar images"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid() is not null);

-- 본인이 올린 사진 또는 관리자만 교체/삭제 가능
create policy "owners or admin can update avatar images"
  on storage.objects for update
  using (bucket_id = 'avatars' and (owner = auth.uid() or is_admin()));

create policy "owners or admin can delete avatar images"
  on storage.objects for delete
  using (bucket_id = 'avatars' and (owner = auth.uid() or is_admin()));
