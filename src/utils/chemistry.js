// 궁합 % -> 재미있는 등급 라벨. 단순 숫자보다 감정을 자극해서 공유하고 싶게 만드는 용도.
export function chemistryTier(percent) {
  if (percent >= 92) return { emoji: "💘", label: "영혼의 동반자" };
  if (percent >= 80) return { emoji: "❤️", label: "거의 찰떡궁합" };
  if (percent >= 65) return { emoji: "😊", label: "꽤 잘 맞음" };
  if (percent >= 50) return { emoji: "🤔", label: "생각보다 다른데?" };
  if (percent >= 30) return { emoji: "😂", label: "서로 이해가 필요함" };
  return { emoji: "💥", label: "만나면 싸울 듯" };
}
