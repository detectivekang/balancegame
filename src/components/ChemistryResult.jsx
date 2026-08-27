import React from "react";

function matchLabel(percent) {
  if (percent >= 90) return { emoji: "💘", label: "천생연분!", desc: "이 정도면 취향이 거의 똑같아요." };
  if (percent >= 70) return { emoji: "😊", label: "잘 맞아요", desc: "대체로 비슷한 선택을 했네요." };
  if (percent >= 40) return { emoji: "🤔", label: "반반이에요", desc: "의견이 반씩 갈렸어요." };
  return { emoji: "🙃", label: "정반대 취향", desc: "다르니까 더 재밌는 사이일지도?" };
}

export default function ChemistryResult({ partnerName, percent, matched, total, onCreateLink, onHome, linkState }) {
  const info = matchLabel(percent);

  return (
    <div className="deck-result">
      <div className="deck-result__card">
        <div className="deck-result__badge">👯 궁합 결과</div>
        <h2 className="deck-result__deck-title">{partnerName}님과의 궁합</h2>

        <div className="chemistry-result__percent">{percent}%</div>
        <div className="chemistry-result__emoji">{info.emoji}</div>
        <div className="deck-result__persona">{info.label}</div>
        <p className="deck-result__desc">{info.desc}</p>
        <p className="chemistry-result__detail">
          {total}문제 중 {matched}개 일치했어요
        </p>

        <button className="deck-result__share-btn" onClick={onCreateLink} disabled={linkState === "creating"}>
          {linkState === "creating" && "링크 만드는 중..."}
          {linkState === "shared" && "✅ 다음 친구에게 보냈어요"}
          {linkState === "copied" && "✅ 궁합 링크 복사됐어요"}
          {(linkState === "idle" || !linkState) && "👯 나도 다른 친구랑 궁합 보기"}
        </button>

        <div className="deck-result__actions">
          <button className="deck-result__btn is-ghost" onClick={onHome}>
            홈으로
          </button>
        </div>
      </div>
    </div>
  );
}
