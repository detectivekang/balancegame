import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

// [수정] 공유 딥링크(HashRouter의 #/worldcup/result/:id, #/chemistry/:id)가
// 카카오톡/인스타그램 등 메신저 인앱 브라우저에서 안 열리던 문제 수정.
// 이런 인앱 브라우저들은 링크를 열 때 URL의 "#해시" 부분을 잘라버리는 경우가
// 많아서, 공유했던 결과 링크가 그냥 사이트 첫 화면(홈)으로만 열렸음.
// 그래서 공유 URL 자체는 해시가 아니라 "?wc=아이디" / "?chem=아이디" 같은
// 쿼리스트링으로 만들고(쿼리스트링은 인앱 브라우저가 보통 안 자름),
// HashRouter가 라우트를 읽기 전인 지금 시점에 쿼리스트링을 원래의 해시
// 라우트로 바꿔치기해줌. (실제 URL 생성 쪽은 WorldCupResult.jsx 등에서 수정)
(function restoreSharedLinkFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const wcResultId = params.get("wc");
  const chemResultId = params.get("chem");
  let newHash = null;

  if (wcResultId) newHash = `#/worldcup/result/${wcResultId}`;
  else if (chemResultId) newHash = `#/chemistry/${chemResultId}`;

  if (newHash) {
    // 쿼리스트링은 제거하고 해시만 남겨서, 이후 HashRouter가 정상 라우트로 인식하게 함
    window.history.replaceState(null, "", window.location.pathname + newHash);
  }
})();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// PWA 설치(홈 화면에 추가)를 위한 최소 서비스워커 등록.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((err) => {
      console.error("서비스워커 등록 실패:", err);
    });
  });
}
