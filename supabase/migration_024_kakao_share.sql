-- ============================================================================
-- 마이그레이션 024: 카카오톡 "바로 공유" (다운로드 없이 링크로 카톡 전송)
--
-- 카카오톡 공유(Kakao.Share)는 이미지를 blob이 아니라 "실제로 접근 가능한
-- 공개 URL"로 받아야 해서, 공유 카드 이미지를 잠깐 올려둘 Storage 버킷이 필요함.
-- avatars/worldcup-images 버킷과 동일한 패턴 (공개 읽기, 로그인 유저 업로드).
--
-- Supabase 대시보드 > SQL Editor 에서 이 파일 전체를 붙여넣고 실행하세요.
-- (migration_023까지 실행한 프로젝트 기준)
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('share-cards', 'share-cards', true)
on conflict (id) do nothing;

create policy "share card images are publicly viewable"
  on storage.objects for select
  using (bucket_id = 'share-cards');

create policy "authenticated users can upload share card images"
  on storage.objects for insert
  with check (bucket_id = 'share-cards' and auth.uid() is not null);
