import React from "react";
import { useSession } from "../hooks/useSession";

function formatMinutes(ms) {
  const min = Math.ceil(ms / 60000);
  return min <= 1 ? "1분" : `${min}분`;
}

export default function EnergyEmpty() {
  const { player } = useSession();

  return (
    <div className="energy-empty">
      <div className="energy-empty__icon">⚡</div>
      <h3>에너지가 모두 소진됐어요</h3>
      <p>
        {player?.msUntilNext
          ? `${formatMinutes(player.msUntilNext)} 후에 에너지가 1 채워져요.`
          : "잠시 후 다시 시도해주세요."}
      </p>
      <p className="energy-empty__desc">30분마다 에너지가 1씩 자동으로 회복돼요.</p>
    </div>
  );
}
