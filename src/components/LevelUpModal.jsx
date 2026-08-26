import React from "react";
import { useSession } from "../hooks/useSession";

export default function LevelUpModal() {
  const { levelUpInfo, dismissLevelUp } = useSession();
  if (!levelUpInfo) return null;

  return (
    <div className="levelup-modal__backdrop" onClick={dismissLevelUp}>
      <div className="levelup-modal__card" onClick={(e) => e.stopPropagation()}>
        <div className="levelup-modal__burst">🎉</div>
        <p className="levelup-modal__eyebrow">LEVEL UP</p>
        <h2 className="levelup-modal__level">Lv.{levelUpInfo.level}</h2>
        <span className="levelup-modal__tier" style={{ background: levelUpInfo.tier.color }}>
          {levelUpInfo.tier.label}
        </span>
        <p className="levelup-modal__desc">
          최대 에너지가 늘어났어요! 새로 열린 문제집이 있는지 홈에서 확인해보세요 🔓
        </p>
        <button onClick={dismissLevelUp}>확인</button>
      </div>
    </div>
  );
}
