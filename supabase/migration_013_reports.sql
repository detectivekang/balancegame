-- ============================================================================
-- 마이그레이션 013: 신고 기능
--
-- 유저가 업로드하는 콘텐츠(월드컵 이미지, 문제집/문제)에 대해 커뮤니티 자체
-- 신고가 가능하게 함. 관리자 승인 전이어도, 승인된 뒤에 문제가 되는 콘텐츠도
-- 신고로 걸러낼 수 있음.
--
-- target_label/target_image_url은 신고 시점의 스냅샷을 같이 저장해서, 관리자가
-- 신고함 목록만 보고도 바로 무슨 콘텐츠인지 파악할 수 있게 함(원본이 나중에
-- 수정/삭제돼도 신고 내역 자체는 남도록).
--
-- Supabase 대시보드 > SQL Editor 에서 이 파일 전체를 붙여넣고 실행하세요.
-- ============================================================================

create table reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('question', 'question_set', 'worldcup', 'worldcup_item')),
  target_id uuid not null,
  target_label text,
  target_image_url text,
  reporter_id uuid references profiles(id) on delete set null,
  reason text not null,
  detail text,
  status text not null default 'pending', -- 'pending' | 'reviewed' | 'dismissed'
  created_at timestamptz not null default now()
);

alter table reports enable row level security;

create policy "logged in users can create reports"
  on reports for insert
  with check (auth.uid() is not null and reporter_id = auth.uid());

create policy "admin can view reports"
  on reports for select
  using (is_admin());

create policy "admin can update reports"
  on reports for update
  using (is_admin());

create index reports_status_idx on reports(status);
