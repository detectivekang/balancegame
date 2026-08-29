// Google Analytics 4(GA4) 연동 유틸.
//
// ⚠️ 측정 ID를 넣기 전까지는 아무 일도 안 일어남 (스크립트 로딩조차 안 함) -
// 안 넣어도 앱은 정상 동작하고, 나중에 아무 때나 켤 수 있음.
//
// 설정 방법:
//   1) https://analytics.google.com 에서 속성(Property) 만들고
//      "데이터 스트림 > 웹" 추가해서 측정 ID(G-XXXXXXXXXX) 발급받기
//   2) 아래 GA_MEASUREMENT_ID에 그 값 넣기
//   3) 재배포
//
// 왜 이벤트를 이렇게 나눴는지: 이 앱의 핵심 질문은 "어떤 콘텐츠가 실제로
// 공유/재방문을 만들어내는가"라서, 그냥 페이지뷰만 보는 걸로는 부족함.
// 그래서 깔때기(퍼널)의 각 단계 - 콘텐츠 완료, 공유 시도, 공유 성공, 결제,
// 광고 보상 - 를 전부 커스텀 이벤트로 남기게 해뒀음. GA4 대시보드에서
// "탐색 분석 > 퍼널 탐색"으로 chemistry_test_complete → share →
// chemistry_detail_unlock 흐름을 그대로 볼 수 있음.
const GA_MEASUREMENT_ID = "여기에_GA4_측정ID를_넣으세요"; // 예: "G-XXXXXXXXXX"

let initialized = false;

export function isAnalyticsConfigured() {
  return Boolean(GA_MEASUREMENT_ID) && GA_MEASUREMENT_ID.startsWith("G-");
}

/**
 * gtag.js를 딱 한 번만 로드하고 초기화함. 앱 최상단(App.jsx)에서 한 번만 호출.
 */
export function initAnalytics() {
  if (!isAnalyticsConfigured() || initialized) return;
  initialized = true;

  window.dataLayer = window.dataLayer || [];
  // eslint-disable-next-line no-inner-declarations
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = gtag;
  gtag("js", new Date());
  // 이 앱은 HashRouter라 route 변경이 실제 페이지 로드를 안 일으켜서,
  // 자동 page_view 대신 trackPageView()로 직접 보냄.
  gtag("config", GA_MEASUREMENT_ID, { send_page_view: false });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);
}

/**
 * HashRouter라서 라우트가 바뀌어도 브라우저가 새 페이지를 로드했다고 인식 안 함 -
 * 그래서 라우트 변경마다 이 함수를 직접 호출해서 page_view를 보내야 함.
 */
export function trackPageView(path) {
  if (!isAnalyticsConfigured() || !window.gtag) return;
  window.gtag("event", "page_view", {
    page_path: path,
    page_location: window.location.href,
  });
}

/**
 * 커스텀 이벤트 전송. GA4 표준 이벤트 이름(share, sign_up, purchase 등)은
 * 되도록 그대로 쓰고, 이 앱 고유의 흐름(궁합 완료, 광고 보상 등)은 새로 정의함.
 */
export function trackEvent(name, params = {}) {
  if (!isAnalyticsConfigured() || !window.gtag) return;
  window.gtag("event", name, params);
}
