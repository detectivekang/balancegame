import React, { useEffect, useRef } from "react";

let scriptLoadPromise = null;
function loadAdFitScript() {
  if (scriptLoadPromise) return scriptLoadPromise;
  scriptLoadPromise = new Promise((resolve, reject) => {
    if (document.querySelector('script[src*="ba.min.js"]')) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://t1.daumcdn.net/kas/static/ba.min.js";
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });
  return scriptLoadPromise;
}

// 카카오 AdFit 배너 광고.
// ⚠️ adUnit은 카카오 AdFit(https://adfit.kakao.com)에 매체 등록하고 광고 단위를
//    만들어야 발급되는 실제 ID로 교체해야 광고가 노출됩니다. 승인 전까지는
//    빈 영역으로만 보이고 광고는 안 뜨니 정상입니다.
export default function AdFitBanner({ adUnit = "DAN-XXXXXXXXXXXXXXXX", width = 320, height = 100 }) {
  const containerRef = useRef(null);

  useEffect(() => {
    loadAdFitScript().catch((err) => console.error("AdFit 스크립트 로딩 실패:", err));
  }, []);

  return (
    <div className="adfit-banner" ref={containerRef}>
      <ins
        className="kakao_ad_area"
        style={{ display: "block" }}
        data-ad-unit={adUnit}
        data-ad-width={width}
        data-ad-height={height}
      />
    </div>
  );
}
