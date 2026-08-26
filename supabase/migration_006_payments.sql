-- ============================================================================
-- 마이그레이션 006: 무제한 이용권 결제 내역
-- Supabase 대시보드 > SQL Editor 에서 이 파일 전체를 붙여넣고 실행하세요.
-- ============================================================================

create table payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  order_id text not null unique,
  amount int not null,
  status text not null default 'pending', -- pending | paid | failed
  plan text not null default 'unlimited_monthly',
  toss_payment_key text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

alter table payments enable row level security;

create policy "users can view own payments"
  on payments for select
  using (user_id = auth.uid());

-- 결제 생성(주문서)은 클라이언트에서, 결제 확정(paid 처리)은 반드시
-- confirm-payment 엣지 함수(서비스 롤 키 사용)에서만 하도록 insert/update는 제한.
create policy "users can create own pending payment"
  on payments for insert
  with check (user_id = auth.uid() and status = 'pending');

create index payments_user_id_idx on payments(user_id);
