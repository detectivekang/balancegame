// 브라우저 Web Push 구독/해지 유틸.
// VAPID 공개키는 "공개"돼도 되는 값이라 (비밀키만 서버 시크릿으로 보관) 여기 그대로 둠.
// supabase/functions/_shared/push.ts 에 있는 비밀키와 반드시 한 쌍이어야 함.
const VAPID_PUBLIC_KEY =
  "BJTjqDJ7MqE4hpyJN3Z_AuEAt2VBxFxbbBOXdYWzo4w4sFZ5J4AUZYym4TkJ2iMBHB-zt2r-lvPgjVg0uUWxINQ";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function isPushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function getNotificationPermission() {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission; // 'granted' | 'denied' | 'default'
}

/**
 * 알림 권한을 요청하고, 허용되면 실제로 구독까지 만들어서 DB에 저장함.
 * 반환값: 'subscribed' | 'denied' | 'unsupported' | 'error'
 */
export async function subscribeToPush(supabase, userId) {
  if (!isPushSupported()) return "unsupported";

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";

  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const json = subscription.toJSON();
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: userId,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      },
      { onConflict: "endpoint" }
    );
    if (error) throw error;

    return "subscribed";
  } catch (err) {
    console.error("푸시 구독 실패:", err);
    return "error";
  }
}

/**
 * 이 기기의 구독을 해지하고 DB에서도 지움.
 */
export async function unsubscribeFromPush(supabase) {
  if (!isPushSupported()) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;

    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  } catch (err) {
    console.error("푸시 해지 실패:", err);
  }
}

/**
 * 이 기기에 이미 구독이 돼있는지 (알림 켜짐 표시용)
 */
export async function isSubscribed() {
  if (!isPushSupported()) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return Boolean(subscription);
  } catch (err) {
    return false;
  }
}
