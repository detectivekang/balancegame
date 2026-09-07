import React, { useMemo, useState } from "react";
import { useSession } from "../hooks/useSession";
import AdFitBanner from "./AdFitBanner";

const CONFETTI_COLORS = ["#ff5470", "#3f8efc", "#6c5ce7", "#ffc93c", "#3ecf9e"];

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.4,
        duration: 1.6 + Math.random() * 1.2,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        rotate: Math.random() * 360,
      })),
    []
  );

  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti__piece"
          style={{
            left: `${p.left}%`,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </div>
  );
}

export default function DeckResult({
  deckTitle,
  answers,
  onRestart,
  onOtherDecks,
  onHome,
  onCreateChemistryLink,
}) {
  const { player } = useSession();
  const [chemistryState, setChemistryState] = useState("idle"); // idle | creating | shared | copied | error

  const handleChemistryShare = async () => {
    if (chemistryState === "creating" || !onCreateChemistryLink) return;
    setChemistryState("creating");

    let url = null;
    try {
      url = await onCreateChemistryLink();
    } catch (err) {
      console.error("궁합 링크 생성 실패:", err);
      setChemistryState("error");
      setTimeout(() => setChemistryState("idle"), 2000);
      return;
    }

    const chemistryText = `밸런스 게임 - "${deckTitle}" 궁합 테스트\n${url}`;

    // 기기 자체 공유 시트를 거치면 시트 안의 OS "복사" 버튼이 url만 복사하고
    // 문구는 버리는 경우가 있어서, 무조건 우리가 직접 전체 문구를 복사한다.
    try {
      await navigator.clipboard.writeText(chemistryText);
      setChemistryState("copied");
    } catch (err) {
      console.error("궁합 링크 복사 실패:", err);
      setChemistryState("error");
    }
    setTimeout(() => setChemistryState("idle"), 2500);
  };

  return (
    <div className="deck-result">
      <Confetti />
      <div className="deck-result__card">
        <div className="deck-result__badge">🎉 문제집 완료!</div>
        <h2 className="deck-result__deck-title">{deckTitle}</h2>

        {answers.length > 0 && (
          <div className="deck-result__stats">
            <h3 className="deck-result__stats-title">📊 문제별 통계</h3>
            {answers.map((a, i) => {
              const total = a.votesA + a.votesB;
              const percentA = total > 0 ? Math.round((a.votesA / total) * 100) : 50;
              const percentB = 100 - percentA;
              return (
                <div key={a.questionId || i} className="deck-result__stat-item">
                  {a.question && <p className="deck-result__stat-question">{a.question}</p>}
                  <div className="balance-result balance-result--reveal">
                    <div className="balance-result__row">
                      <div className="balance-result__labels">
                        <span>{a.optionA || "A"}</span>
                        <span className="balance-result__percent">{percentA}%</span>
                      </div>
                      <div className="balance-result__track">
                        <div
                          className={`balance-result__fill opt-a ${a.side === "A" ? "is-my-choice" : ""}`}
                          style={{ width: `${percentA}%` }}
                        />
                      </div>
                    </div>
                    <div className="balance-result__row">
                      <div className="balance-result__labels">
                        <span>{a.optionB || "B"}</span>
                        <span className="balance-result__percent">{percentB}%</span>
                      </div>
                      <div className="balance-result__track">
                        <div
                          className={`balance-result__fill opt-b ${a.side === "B" ? "is-my-choice" : ""}`}
                          style={{ width: `${percentB}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {onCreateChemistryLink && (
          <button
            className="deck-result__chemistry-btn"
            onClick={handleChemistryShare}
            disabled={chemistryState === "creating"}
          >
            {chemistryState === "creating" && "링크 만드는 중..."}
            {chemistryState === "shared" && "✅ 친구에게 보냈어요"}
            {chemistryState === "copied" && "✅ 궁합 링크 복사됐어요"}
            {chemistryState === "error" && "⚠️ 실패했어요, 다시 시도해주세요"}
            {chemistryState === "idle" && "👯 친구랑 궁합 테스트하기"}
          </button>
        )}

        <div className="deck-result__actions">
          <button className="deck-result__btn is-primary" onClick={onRestart}>
            다시 하기
          </button>
          <button className="deck-result__btn" onClick={onOtherDecks}>
            다른 문제집 보기
          </button>
          <button className="deck-result__btn is-ghost" onClick={onHome}>
            홈으로
          </button>
        </div>

        {!player?.isPremium && (
          <div className="deck-result__ad">
            <AdFitBanner adUnit="DAN-XXXXXXXXXXXXXXXX" width={320} height={100} />
          </div>
        )}
      </div>
    </div>
  );
}
