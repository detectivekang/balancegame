import React, { createContext, useContext, useEffect, useState } from "react";
import { doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { getDeviceId } from "./useDevice";
import {
  energyCapForLevel,
  ENERGY_REGEN_MS,
  levelForXp,
  tierForLevel,
  xpToNextLevel,
} from "../utils/levels";

const PlayerContext = createContext(null);

export function PlayerProvider({ children }) {
  const [raw, setRaw] = useState(null); // Firestore users/{deviceId} 원본 데이터
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const deviceId = getDeviceId();
    const ref = doc(db, "users", deviceId);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) setRaw(snap.data());
    });
    return unsub;
  }, []);

  // 에너지 회복 카운트다운 표시를 위해 주기적으로 리렌더
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  const value = React.useMemo(() => {
    if (!raw) return null;

    const xp = raw.xp || 0;
    const level = levelForXp(xp);
    const cap = energyCapForLevel(level);
    const storedEnergy = raw.energy ?? cap;
    const updatedAtMs = raw.energyUpdatedAt?.toMillis ? raw.energyUpdatedAt.toMillis() : now;
    const elapsedMs = Math.max(0, now - updatedAtMs);
    const regen = Math.floor(elapsedMs / ENERGY_REGEN_MS);
    const currentEnergy = Math.min(cap, storedEnergy + regen);
    const msUntilNext =
      currentEnergy >= cap ? null : ENERGY_REGEN_MS - (elapsedMs % ENERGY_REGEN_MS);

    const spendEnergyAndGainXp = async () => {
      if (currentEnergy <= 0) return false;
      const deviceId = getDeviceId();
      const payload = {
        energy: currentEnergy - 1,
        xp: xp + 1,
      };
      // 리젠분을 이미 반영했다면 기준 시각을 지금으로 갱신, 아니면 그대로 유지(부분 경과시간 보존)
      if (regen > 0) payload.energyUpdatedAt = serverTimestamp();
      await updateDoc(doc(db, "users", deviceId), payload);
      return true;
    };

    return {
      xp,
      level,
      tier: tierForLevel(level),
      cap,
      currentEnergy,
      msUntilNext,
      progress: xpToNextLevel(level, xp),
      spendEnergyAndGainXp,
    };
  }, [raw, now]);

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  return useContext(PlayerContext);
}
