import React, { useState } from "react";
import { useSession } from "../hooks/useSession";

const AD_DURATION_MS = 2500;

// 실제 서비스 연동 시 이 컴포넌트의 useEffect 시뮬레이션 부분만
// AdMob/카카오 AdFit 등의 "보상형 광고 SDK" 호출로 교체하면 됨.
// (SDK의 onAdCompleted 콜백에서 claimAdEnergy()를 호출)
export default function AdWatchModal({ onClose }) {
  const { claimAdEnergy } = useSession();
  const [phase, setPhase] = useState("playing"); // playing | granting | done | error
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  React.useEffect(() => {
    const t = setTimeout(async () => {
      setPhase("granting");
      try {
        const data = await claimAdEnergy();
        setResult(data);
        setPhase("done");
      } catch (err) {
        const raw = err?.message || "";
        setErrorMsg(raw.includes("ad limit") ? "오늘 광고 보상은 모두 받았어요. 내일 다시 와주세요!" : "보상 지급에 실패했어요.");
        setPhase("error");
      }
    }, AD_DURATION_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="ad-modal__backdrop" onClick={phase === "playing" ? undefined : onClose}>
      <div className="ad-modal__card" onClick={(e) => e.stopPropagation()}>
        {phase === "playing" && (
          <>
            <div className="ad-modal__spinner" />
            <p>광고를 보고 있어요...</p>
          </>
        )}
        {phase === "granting" && <p>보상 지급 중...</p>}
        {phase === "done" && (
          <>
            <div className="ad-modal__icon">⚡️</div>
            <h3>+3 에너지 획득!</h3>
            <p>
              오늘 {result.remaining_today}회 더 받을 수 있어요.
            </p>
            <button onClick={onClose}>확인</button>
          </>
        )}
        {phase === "error" && (
          <>
            <div className="ad-modal__icon">😢</div>
            <p>{errorMsg}</p>
            <button onClick={onClose}>확인</button>
          </>
        )}
      </div>
    </div>
  );
}
