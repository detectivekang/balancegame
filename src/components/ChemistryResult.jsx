import React from "react";
import { chemistryTier } from "../utils/chemistry";

export default function ChemistryResult({
  partnerName,
  percent,
  matched,
  total,
  detailItems, // [{ id, question, myLabel, theirLabel, isMatch }]
  unlocked, // 로그인 완료 -> 상세 결과 펼칠 수 있음
  detailPending, // "결과 보기" 눌러서 로그인하러 가는 중
  onViewDetail,
  onCreateLink,
  onHome,
  linkState,
}) {
  const tier = chemistryTier(percent);

  return (
    <div className="deck-result">
      <div className="deck-result__card">
        <div className="deck-result__badge">👯 궁합 결과</div>
        <h2 className="deck-result__deck-title">{partnerName}님과의 궁합</h2>

        <div className="chemistry-result__percent">{percent}%</div>
        <div className="chemistry-result__emoji">{tier.emoji}</div>
        <div className="deck-result__persona">{tier.label}</div>
        <p className="chemistry-result__detail">
          {total}문제 중 {matched}개 일치했어요
        </p>

        {!unlocked && (
          <div className="chemistry-gate">
            <p className="chemistry-gate__desc">{partnerName}님의 결과와 문제별로 비교하려면?</p>
            <button className="chemistry-gate__btn" onClick={onViewDetail} disabled={detailPending}>
              {detailPending ? "로그인하러 가는 중..." : "🔍 상세 결과 보기"}
            </button>
          </div>
        )}

        {unlocked && detailItems && detailItems.length > 0 && (
          <div className="chemistry-detail">
            <p className="chemistry-detail__title">📋 문제별 비교</p>
            {detailItems.map((item) => (
              <div
                key={item.id}
                className={`chemistry-detail__item ${item.isMatch ? "is-match" : "is-diff"}`}
              >
                <div className="chemistry-detail__question">{item.question}</div>
                <div className="chemistry-detail__answers">
                  <span className="chemistry-detail__me">나: {item.myLabel}</span>
                  <span className="chemistry-detail__them">
                    {partnerName}: {item.theirLabel}
                  </span>
                  <span className="chemistry-detail__mark">{item.isMatch ? "✅" : "❌"}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {unlocked && (
          <button className="deck-result__share-btn" onClick={onCreateLink} disabled={linkState === "creating"}>
            {linkState === "creating" && "링크 만드는 중..."}
            {linkState === "shared" && "✅ 다음 친구에게 보냈어요"}
            {linkState === "copied" && "✅ 궁합 링크 복사됐어요"}
            {(linkState === "idle" || !linkState) && "👯 나도 다른 친구랑 궁합 보기"}
          </button>
        )}

        <div className="deck-result__actions">
          <button className="deck-result__btn is-ghost" onClick={onHome}>
            홈으로
          </button>
        </div>
      </div>
    </div>
  );
}
