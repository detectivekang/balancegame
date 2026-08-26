import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useSession } from "../hooks/useSession";
import { MAX_LEVEL } from "../utils/levels";
import { nextStreakMilestone, STREAK_MILESTONES } from "../utils/streak";
import AdWatchModal from "./AdWatchModal";

function formatMinutes(ms) {
  const min = Math.ceil(ms / 60000);
  return min <= 1 ? "1분" : `${min}분`;
}

export default function PlayerStatusBar() {
  const { player, streak, claimStreakBonus } = useSession();
  const [showAd, setShowAd] = useState(false);
  const [claimingMilestone, setClaimingMilestone] = useState(false);

  if (!player) return null;

  const { level, tier, xp, progress, cap, currentEnergy, msUntilNext } = player;
  const percent = progress ? Math.min(100, Math.round((progress.current / progress.needed) * 100)) : 100;
  const energyFull = currentEnergy >= cap;
  const reachedMilestone = STREAK_MILESTONES.includes(streak) ? streak : null;
  const upcoming = nextStreakMilestone(streak);

  const handleClaimStreak = async () => {
    if (!reachedMilestone || claimingMilestone) return;
    setClaimingMilestone(true);
    try {
      await claimStreakBonus(reachedMilestone);
    } catch (err) {
      console.error("스트릭 보너스 수령 실패:", err);
    } finally {
      setClaimingMilestone(false);
    }
  };

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
        {streak > 0 && <span className="player-status__streak">🔥 {streak}일 연속</span>}
        {player.isPremium ? (
          <span className="player-status__premium">👑 무제한</span>
        ) : (
          <span className="player-status__energy">
            ⚡ {currentEnergy}/{cap}
            {msUntilNext && (
              <span className="player-status__energy-timer"> ({formatMinutes(msUntilNext)} 후 +1)</span>
            )}
          </span>
        )}
        {!energyFull && !player.isPremium && (
          <button className="player-status__ad-btn" onClick={() => setShowAd(true)}>
            🎬 +3
          </button>
        )}
        {!player.isPremium && (
          <Link to="/upgrade" className="player-status__upgrade-link">
            👑
          </Link>
        )}
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

      {reachedMilestone && (
        <button className="player-status__streak-claim" onClick={handleClaimStreak} disabled={claimingMilestone}>
          🎁 {reachedMilestone}일 연속 출석 보너스 받기
        </button>
      )}
      {!reachedMilestone && upcoming && streak > 0 && (
        <p className="player-status__streak-hint">
          {upcoming - streak}일만 더 접속하면 {upcoming}일 연속 보너스!
        </p>
      )}

      {showAd && <AdWatchModal onClose={() => setShowAd(false)} />}
    </div>
  );
}
