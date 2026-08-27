export const WORLDCUP_CATEGORIES = ["애니", "아이돌", "배우", "게임", "상황"];

export const WORLDCUP_CATEGORY_META = {
  애니: { emoji: "🎨", className: "is-anime" },
  아이돌: { emoji: "🎤", className: "is-kpop" },
  배우: { emoji: "🎭", className: "is-actor" },
  게임: { emoji: "🎮", className: "is-game" },
  상황: { emoji: "🌀", className: "is-scenario" },
};

export function worldcupCategoryMeta(category) {
  return WORLDCUP_CATEGORY_META[category] || { emoji: "🏆", className: "" };
}

// 최종 라운드는 이 중에서 "아이템 개수 이하로 만들 수 있는 가장 큰 값들" 위주로 선택지를 제공
export const ROUND_SIZES = [4, 8, 16, 32, 64, 128, 256];
