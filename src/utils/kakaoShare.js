// 카카오톡 "바로 공유" 유틸.
//
// 지금까지는 이미지 카드를 만들어서 "다운로드 후 직접 카톡에 붙여넣기"로
// 보내야 했음. 이 파일은 카카오 JavaScript SDK(Kakao.Share)를 붙여서,
// 다운로드 없이 버튼 한 번으로 바로 카톡 공유 시트가 뜨게 해줌.
//
// ⚠️ 반드시 필요한 사전 설정 (안 하면 자동으로 기존 방식으로 대체됨):
//   1) https://developers.kakao.com 에서 내 애플리케이션 > 앱 설정 > 요약 정보에서
//      "JavaScript 키" 발급받기 (로그인에 쓰는 REST API 키와는 다른 키!)
//   2) 아래 KAKAO_JS_KEY에 그 키를 넣기
//   3) 플랫폼 설정 > Web 플랫폼에 실제 배포 도메인 등록
//      (예: https://내아이디.github.io) - 등록 안 하면 카톡 공유가 조용히 실패함
//   4) 카카오 디벨로퍼스 > 제품 설정 > 카카오 로그인 등은 이미 쓰고 있으니 그대로 두고,
//      "카카오톡 공유" 제품만 추가로 활성화하기
const KAKAO_JS_KEY = "여기에_카카오_JavaScript_키를_넣으세요";

let sdkLoadPromise = null;

function loadKakaoSdkScript() {
  if (window.Kakao) return Promise.resolve();
  if (sdkLoadPromise) return sdkLoadPromise;

  sdkLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js";
    script.crossOrigin = "anonymous";
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return sdkLoadPromise;
}

/**
 * 카카오 공유가 실제로 쓸 수 있는 상태인지 (JS 키를 설정 안 했으면 항상 false).
 * 이 함수가 false면 호출부는 기존 "이미지+링크 복사" 방식으로 자동 대체해야 함.
 */
export function isKakaoShareConfigured() {
  return Boolean(KAKAO_JS_KEY) && !KAKAO_JS_KEY.includes("여기에");
}

async function ensureKakaoInit() {
  await loadKakaoSdkScript();
  if (!window.Kakao.isInitialized()) {
    window.Kakao.init(KAKAO_JS_KEY);
  }
}

/**
 * 카카오톡 공유 시트를 바로 띄움 (다운로드 없이) - "피드" 템플릿 사용.
 * imageUrl은 반드시 실제로 접근 가능한 공개 URL이어야 함 (blob URL 안 됨 -
 * 카톡 서버가 직접 이미지를 가져가기 때문).
 *
 * 반환값: 'shared' | 'unavailable' | 'error'
 */
export async function shareToKakaoTalk({ title, description, imageUrl, linkUrl, buttonLabel = "확인하기" }) {
  if (!isKakaoShareConfigured()) return "unavailable";

  try {
    await ensureKakaoInit();
    window.Kakao.Share.sendDefault({
      objectType: "feed",
      content: {
        title,
        description,
        imageUrl,
        link: { webUrl: linkUrl, mobileWebUrl: linkUrl },
      },
      buttons: [
        {
          title: buttonLabel,
          link: { webUrl: linkUrl, mobileWebUrl: linkUrl },
        },
      ],
    });
    return "shared";
  } catch (err) {
    console.error("카카오톡 공유 실패:", err);
    return "error";
  }
}
