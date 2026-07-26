import React from "react";
import { useSession } from "../hooks/useSession";
import { MAX_LEVEL } from "../utils/levels";

function formatMinutes(ms) {
  const min = Math.ceil(ms / 60000);
  return min <= 1 ? "1분" : `${min}분`;
}

export default function PlayerStatusBar() {
  const { player } = useSession();
  if (!player) return null;

  const { level, tier, xp, progress, cap, currentEnergy, msUntilNext } = player;
  const percent = progress ? Math.min(100, Math.round((progress.current / progress.needed) * 100)) : 100;

  return (
    <div className="player-status">
      <div className="player-status__top">
        <span className="player-status__tier" style={{ background: tier.color }}>
          {tier.label}
        </span>
        <span className="player-status__level">
          Lv.{level}
          {level >= MAX_LEVEL && " (MAX)"}
        </span>
        <span className="player-status__energy">
          ⚡ {currentEnergy}/{cap}
          {msUntilNext && (
            <span className="player-status__energy-timer"> ({formatMinutes(msUntilNext)} 후 +1)</span>
          )}
        </span>
      </div>

      {progress && (
        <div className="player-status__xp-track">
          <div className="player-status__xp-fill" style={{ width: `${percent}%` }} />
        </div>
      )}
      {progress && (
        <div className="player-status__xp-label">
          {progress.current} / {progress.needed} XP (총 {xp} XP)
        </div>
      )}
    </div>
  );
}
