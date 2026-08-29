// 최소 서비스워커 - PWA 설치(홈 화면에 추가) 조건을 만족시키기 위한 용도.
// 일부러 아무것도 캐싱하지 않음: 캐싱을 하면 배포한 새 버전이 안 보이는 문제가
// 생길 수 있고, 이미 앱 안에 자체 "새 버전 감지" 배너(UpdateBanner)가 있어서
// 서비스워커 캐시 레이어는 오히려 그걸 방해할 수 있음. 그래서 항상 네트워크로
// 그대로 흘려보내기만 함.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});

// ----------------------------------------------------------------------------
// 웹 푸시 알림 수신 - 서버(Edge Function)가 보낸 { title, body, url } 형태의
// JSON을 그대로 알림으로 띄움. 클릭하면 url로 이동(이미 열려있는 탭이 있으면
// 그 탭을 포커스).
// ----------------------------------------------------------------------------
self.addEventListener("push", (event) => {
  let data = { title: "밸런스게임", body: "새 소식이 있어요!" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (err) {
    // JSON이 아니면 기본 메시지로 대체
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/balancegame/icons/icon-192.png",
      badge: "/balancegame/icons/icon-192.png",
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
