-- ============================================================================
-- 마이그레이션 003: 문제집 커버 사진
-- Supabase 대시보드 > SQL Editor 에서 이 파일 전체를 붙여넣고 실행하세요.
-- (migration_002_question_sets.sql을 먼저 실행한 프로젝트에 적용)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. question_sets.cover_image_url: 문제집 카드 배경 사진 URL
-- ----------------------------------------------------------------------------
alter table question_sets add column cover_image_url text;

-- ----------------------------------------------------------------------------
-- 2. Storage 버킷: 문제집 커버 이미지 저장용 (공개 읽기)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('question-set-covers', 'question-set-covers', true)
on conflict (id) do nothing;

-- 누구나 볼 수 있음 (문제집 카드 배경으로 쓰이므로 공개)
create policy "cover images are publicly viewable"
  on storage.objects for select
  using (bucket_id = 'question-set-covers');

-- 로그인한 유저는 업로드 가능 (앱에서 리사이즈 후 업로드)
create policy "authenticated users can upload cover images"
  on storage.objects for insert
  with check (bucket_id = 'question-set-covers' and auth.uid() is not null);

-- 본인이 올린 사진 또는 관리자만 교체/삭제 가능
create policy "owners or admin can update cover images"
  on storage.objects for update
  using (bucket_id = 'question-set-covers' and (owner = auth.uid() or is_admin()));

create policy "owners or admin can delete cover images"
  on storage.objects for delete
  using (bucket_id = 'question-set-covers' and (owner = auth.uid() or is_admin()));
