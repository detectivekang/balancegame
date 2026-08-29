// 여러 Edge Function(notify-worldcup-approved / notify-chemistry-match /
// notify-full-energy)이 공통으로 쓰는 "실제로 브라우저에 푸시 쏘기" 헬퍼.
//
// 배포 전에 VAPID 키를 시크릿으로 등록해야 함:
//   supabase secrets set VAPID_PUBLIC_KEY=발급받은_공개키
//   supabase secrets set VAPID_PRIVATE_KEY=발급받은_비밀키
//   supabase secrets set VAPID_SUBJECT=mailto:you@example.com
// (이 프로젝트용으로 미리 한 쌍 생성해뒀음 - README_PUSH.md 참고. 원한다면
//  `npx web-push generate-vapid-keys`로 직접 새로 만들어서 교체해도 됨)

import webpush from "npm:web-push@3.6.7";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string; // 알림 클릭 시 이동시킬 경로 (예: "/#/mypage")
};

/**
 * 주어진 유저들의 모든 등록된 구독(여러 기기 가능)에 푸시를 보냄.
 * 이미 만료/삭제된 구독(410/404 응답)은 자동으로 DB에서 지움.
 * supabaseAdmin은 반드시 SERVICE_ROLE 키로 만든 클라이언트여야 함
 * (push_subscriptions는 RLS로 본인만 볼 수 있게 막혀있어서).
 */
export async function sendPushToUsers(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any,
  userIds: string[],
  payload: PushPayload
) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error("VAPID 키가 설정 안 돼있어서 푸시를 보낼 수 없음 (supabase secrets set 필요)");
    return { sent: 0, failed: 0 };
  }
  if (!userIds || userIds.length === 0) return { sent: 0, failed: 0 };

  const { data: subs, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, user_id")
    .in("user_id", userIds);

  if (error) {
    console.error("구독 목록 조회 실패:", error);
    return { sent: 0, failed: 0 };
  }
  if (!subs || subs.length === 0) return { sent: 0, failed: 0 };

  const body = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;
  const deadIds: string[] = [];

  await Promise.all(
    subs.map(async (sub: { id: string; endpoint: string; p256dh: string; auth: string }) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body
        );
        sent += 1;
      } catch (err) {
        failed += 1;
        // deno-lint-ignore no-explicit-any
        const anyErr = err as any;
        const statusCode = anyErr?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // 브라우저에서 알림 권한을 껐거나 구독이 만료된 경우 - 조용히 정리
          deadIds.push(sub.id);
        } else {
          console.error("푸시 발송 실패:", statusCode, anyErr?.body || anyErr);
        }
      }
    })
  );

  if (deadIds.length > 0) {
    await supabaseAdmin.from("push_subscriptions").delete().in("id", deadIds);
  }

  return { sent, failed };
}
