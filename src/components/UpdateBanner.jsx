import React, { useEffect, useState } from "react";

// vite.config.js가 빌드할 때마다 새 값을 박아넣음. 개발 서버(dev)에서는 정의되지 않으므로 폴백 처리.
const CURRENT_VERSION = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5분마다 확인

// 배포 후에도 사용자가 예전 index.html/JS를 계속 들고 있지 않도록,
// public/version.json을 주기적으로 다시 받아서 지금 실행 중인 버전과 비교함.
// 캐시 걸리면 의미가 없으니 매번 캐시 무시하고 새로 받음.
export default function UpdateBanner() {
  const [hasUpdate, setHasUpdate] = useState(false);

  useEffect(() => {
    if (CURRENT_VERSION === "dev") return; // 로컬 개발 중엔 체크 안 함

    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.version && data.version !== CURRENT_VERSION) {
          setHasUpdate(true);
        }
      } catch (err) {
        // 오프라인 등으로 실패해도 조용히 무시 (다음 주기에 재시도)
      }
    };

    check();
    const timer = setInterval(check, CHECK_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (!hasUpdate) return null;

  return (
    <div className="update-banner">
      <span>🎉 새 버전이 나왔어요!</span>
      <button onClick={() => window.location.reload()}>새로고침</button>
    </div>
  );
}
