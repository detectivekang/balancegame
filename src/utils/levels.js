export const MAX_LEVEL = 30;

// 레벨 N -> N+1로 가는 데 필요한 경험치: 100, 300, 500, 700 ... (공차 200 등차수열)
// 레벨1→2: 100, 레벨2→3: 300 (사용자가 지정한 두 값 기준)
export function xpStepForLevel(level) {
  return 200 * level - 100;
}

// 레벨별 "도달에 필요한 누적 경험치" 닫힌 형태(closed form): 100 * (L-1)^2
// (Supabase의 level_for_xp() SQL 함수와 동일한 공식 - 서버/클라이언트 계산이 항상 일치함)
export function levelForXp(xp) {
  const safeXp = Math.max(0, xp || 0);
  const level = Math.floor(Math.sqrt(safeXp / 100)) + 1;
  return Math.min(MAX_LEVEL, level);
}

function cumulativeXpForLevel(level) {
  return 100 * (level - 1) * (level - 1);
}

// 현재 레벨 안에서의 진행도 (프로그레스 바용)
export function xpToNextLevel(level, xp) {
  if (level >= MAX_LEVEL) return null;
  const currentThreshold = cumulativeXpForLevel(level);
  const nextThreshold = cumulativeXpForLevel(level + 1);
  return {
    current: xp - currentThreshold,
    needed: nextThreshold - currentThreshold,
  };
}

// 레벨별 최대 에너지: 레벨1=5, 레벨2=6 ... (레벨 + 4), 30분에 1씩 회복
export function energyCapForLevel(level) {
  return level + 4;
}

export const ENERGY_REGEN_MS = 5 * 60 * 1000; // 30분 -> 5분으로 단축 (라이트 유저 이탈 방지)

// 롤 티어 스타일 등급 (레벨 1~30을 7단계로 분배)
export const TIERS = [
  { key: "iron", label: "아이언", minLevel: 1, maxLevel: 4, color: "#8b8b96" },
  { key: "bronze", label: "브론즈", minLevel: 5, maxLevel: 8, color: "#b06a45" },
  { key: "silver", label: "실버", minLevel: 9, maxLevel: 12, color: "#9aa5b1" },
  { key: "gold", label: "골드", minLevel: 13, maxLevel: 16, color: "#e0a940" },
  { key: "platinum", label: "플래티넘", minLevel: 17, maxLevel: 20, color: "#3ecf9e" },
  { key: "diamond", label: "다이아몬드", minLevel: 21, maxLevel: 25, color: "#5aa9ff" },
  { key: "master", label: "마스터", minLevel: 26, maxLevel: 30, color: "#c65aff" },
];

export function tierForLevel(level) {
  return TIERS.find((t) => level >= t.minLevel && level <= t.maxLevel) || TIERS[0];
}
