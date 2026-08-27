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
