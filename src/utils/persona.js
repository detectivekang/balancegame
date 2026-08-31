// 밸런스게임 결과 페르소나 계산 - Home.jsx(공유 링크 생성)와 DeckResult.jsx(화면 표시)가
// 똑같은 로직을 써야 하므로 공용 유틸로 분리함.

export function pickPersona(answers) {
  const total = answers.length;
  if (total === 0) return { label: "밸런스 요정", desc: "취향이 아직 베일에 싸여 있어요." };
  const aCount = answers.filter((a) => a.side === "A").length;
  const ratioA = aCount / total;

  if (ratioA >= 0.75) return { label: "확신의 A형 인간", desc: "고민 없이 직진하는 타입이네요." };
  if (ratioA <= 0.25) return { label: "확신의 B형 인간", desc: "확고한 취향의 소유자예요." };
  if (ratioA > 0.5) return { label: "살짝 A 쪽 밸런서", desc: "그래도 마음은 A 쪽으로 기울었어요." };
  if (ratioA < 0.5) return { label: "살짝 B 쪽 밸런서", desc: "그래도 마음은 B 쪽으로 기울었어요." };
  return { label: "완벽한 밸런스형", desc: "양쪽 다 이해하는 균형감각의 소유자!" };
}

// 각 문제에서 내가 고른 선택이 "그 순간 기준" 소수의견이었는지 세어봄 -> 재미 요소
export function countMinorityPicks(answers) {
  return answers.filter((a) => {
    const total = a.votesA + a.votesB;
    if (!total) return false;
    const myVotes = a.side === "A" ? a.votesA : a.votesB;
    return myVotes / total < 0.5;
  }).length;
}
