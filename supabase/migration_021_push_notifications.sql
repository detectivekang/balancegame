-- ============================================================================
-- 마이그레이션 021: 웹 푸시 알림 (재방문 유도)
--
-- 세 가지 알림을 붙임:
--   1) 내 월드컵이 승인됐어요 (관리자 승인 직후, Edge Function notify-worldcup-approved)
--   2) 누가 내 궁합 테스트에 참여했어요 (Edge Function notify-chemistry-match)
--   3) 에너지가 다 찼어요 (주기적으로 도는 cron, Edge Function notify-full-energy)
--
-- 브라우저 Web Push 표준을 씀 (카카오 알림톡은 별도 사업자 심사/유료 API가 필요해서
-- 우선 무료로 붙일 수 있는 이 방식부터 감. 나중에 알림톡으로 확장 가능).
--
-- Supabase 대시보드 > SQL Editor 에서 이 파일 전체를 붙여넣고 실행하세요.
-- (migration_020까지 실행한 프로젝트 기준)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. 브라우저 푸시 구독 정보 저장
-- ----------------------------------------------------------------------------
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;

create policy "users manage their own push subscriptions"
  on push_subscriptions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index push_subscriptions_user_id_idx on push_subscriptions(user_id);

-- ----------------------------------------------------------------------------
-- 2. 에너지 "방금 다 찼음" 감지용 - 마지막으로 이 알림을 보낸 시점을 기록해둬서
--    같은 상태(계속 꽉 참)로 며칠이 지나도 매번 다시 알리지 않게 함.
-- ----------------------------------------------------------------------------
alter table profiles add column if not exists energy_full_notified_at timestamptz;

-- ----------------------------------------------------------------------------
-- 3. 지금 에너지가 꽉 찼는데 아직 알림을 못 받은 유저 목록 (cron이 5~10분마다 호출).
--    cast_vote/start_worldcup과 완전히 같은 캡/회복 공식을 그대로 재사용함.
--    service_role 전용 - 다른 유저의 에너지 정보라 일반 유저에게는 절대 노출 안 함.
-- ----------------------------------------------------------------------------
create or replace function full_energy_candidates()
returns table(user_id uuid, energy int, cap int)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    p.id,
    least(v.cap, p.energy + floor(extract(epoch from (now() - p.energy_updated_at)) / 60 / 5)::int) as energy,
    v.cap
  from profiles p
  cross join lateral (select level_for_xp(p.xp) + 9 as cap) v
  where coalesce(p.is_premium, false) = false -- 무제한 이용권 유저는 항상 꽉 차있으니 알릴 필요 없음
    and least(v.cap, p.energy + floor(extract(epoch from (now() - p.energy_updated_at)) / 60 / 5)::int) >= v.cap
    and (p.energy_full_notified_at is null or p.energy_full_notified_at < p.energy_updated_at);
end;
$$;

revoke execute on function full_energy_candidates() from public, anon, authenticated;
grant execute on function full_energy_candidates() to service_role;

-- ----------------------------------------------------------------------------
-- 4. 알림을 보낸 유저들을 "보냄" 처리 (다음 소비 전까지 재알림 방지)
-- ----------------------------------------------------------------------------
create or replace function mark_energy_notified(p_user_ids uuid[])
returns void
language sql
security definer
set search_path = public
as $$
  update profiles set energy_full_notified_at = now() where id = any(p_user_ids);
$$;

revoke execute on function mark_energy_notified(uuid[]) from public, anon, authenticated;
grant execute on function mark_energy_notified(uuid[]) to service_role;
