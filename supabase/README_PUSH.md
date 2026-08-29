# 🔔 푸시 알림 배포 가이드

이번에 추가된 3가지 알림 (월드컵 승인 / 궁합 참여 / 에너지 완충)은 브라우저
Web Push 표준을 씁니다 (무료, 카카오 알림톡 같은 사업자 심사 불필요).

## 1. DB 마이그레이션

Supabase 대시보드 > SQL Editor에서 `migration_021_push_notifications.sql` 전체 실행.

## 2. VAPID 키 확인/교체

이번 작업에서 미리 한 쌍 만들어서 코드에 넣어뒀습니다:

- 공개키(Public Key): `src/utils/push.js`의 `VAPID_PUBLIC_KEY`에 이미 들어있음
- 비밀키(Private Key)는 코드에 넣지 않았음 (아래 3번에서 시크릿으로 등록)

원한다면 직접 새로 발급받아 교체해도 됩니다: `npx web-push generate-vapid-keys`
(교체 시 공개키/비밀키 둘 다 반드시 같이 바꿔야 함 — 한쪽만 바꾸면 발송이 실패함)

## 3. Supabase CLI로 Edge Function 배포 + 시크릿 등록

```bash
supabase functions deploy notify-worldcup-approved
supabase functions deploy notify-chemistry-match
supabase functions deploy notify-full-energy

supabase secrets set VAPID_PUBLIC_KEY=BJTjqDJ7MqE4hpyJN3Z_AuEAt2VBxFxbbBOXdYWzo4w4sFZ5J4AUZYym4TkJ2iMBHB-zt2r-lvPgjVg0uUWxINQ
supabase secrets set VAPID_PRIVATE_KEY=5Lx0cv9C7DMulGf_gr3uc_f1vswTv_Si-pt3gLuVwfE
supabase secrets set VAPID_SUBJECT=mailto:본인이메일주소
supabase secrets set CRON_SECRET=아무_긴_랜덤문자열
```

(SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY는 Supabase가 자동 주입함)

## 4. 에너지 완충 알림 스케줄(cron) 등록

`notify-full-energy` 함수는 사람이 아니라 스케줄러가 주기적으로 호출해야 합니다.

**방법 A - 대시보드 Cron (있는 경우):** Edge Functions > notify-full-energy >
Cron 탭에서 `*/5 * * * *` 로 등록하고, 요청 헤더에 `x-cron-secret: 위에서 정한 값`
추가.

**방법 B - pg_cron + pg_net (더 확실함):** SQL Editor에서:

```sql
select cron.schedule(
  'notify-full-energy',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://<프로젝트ref>.supabase.co/functions/v1/notify-full-energy',
    headers := jsonb_build_object('x-cron-secret', '아무_긴_랜덤문자열'),
    body := '{}'::jsonb
  );
  $$
);
```

(pg_cron, pg_net 확장이 꺼져있으면 Database > Extensions에서 먼저 켜야 함)

## 5. 실제 배포 전 체크리스트

- [ ] `migration_021_push_notifications.sql` 실행함
- [ ] 3개 Edge Function 배포함
- [ ] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT / CRON_SECRET 시크릿 등록함
- [ ] notify-full-energy 크론 등록함
- [ ] 마이페이지에서 "🔔 알림 받기" 켜고 실제로 알림이 오는지 테스트함
  (에너지가 이미 꽉 찬 상태라면 아무거나 조금 써서 깎았다가 다시 채워지길 기다리거나,
  테스트 삼아 SQL Editor에서 `update profiles set energy_full_notified_at = null where id = '내계정id';`
  로 알림 대상 조건을 강제로 만족시켜본 뒤 크론이 돌 때까지 몇 분 기다려보면 됨)
