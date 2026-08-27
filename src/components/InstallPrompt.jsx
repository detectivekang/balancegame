import React, { useEffect, useState } from "react";

const DISMISS_KEY = "installPromptDismissedAt";
const DISMISS_DAYS = 14; // 닫으면 2주간 다시 안 보여줌

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true
  );
}

function isIOS() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

function wasDismissedRecently() {
  const raw = localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const elapsedDays = (Date.now() - Number(raw)) / (1000 * 60 * 60 * 24);
  return elapsedDays < DISMISS_DAYS;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState(null); // 'android' | 'ios'

  useEffect(() => {
    if (isStandalone() || wasDismissedRecently()) return;

    if (isIOS()) {
      setPlatform("ios");
      setVisible(true);
      return;
    }

    const onBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setPlatform("android");
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="install-prompt">
      <span className="install-prompt__icon">📲</span>
      <div className="install-prompt__text">
        {platform === "ios" ? (
          <>
            <b>홈 화면에 추가</b>하고 앱처럼 빠르게 즐겨보세요! 공유 버튼 → "홈 화면에 추가"
          </>
        ) : (
          <>
            <b>앱처럼 설치</b>하고 더 빠르게 즐겨보세요!
          </>
        )}
      </div>
      {platform === "android" && (
        <button className="install-prompt__install-btn" onClick={install}>
          설치
        </button>
      )}
      <button className="install-prompt__close-btn" onClick={dismiss} aria-label="닫기">
        ✕
      </button>
    </div>
  );
}
