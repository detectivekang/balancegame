import React, { useMemo, useState } from "react";

const CONFETTI_COLORS = ["#ff5470", "#3f8efc", "#6c5ce7", "#ffc93c", "#3ecf9e"];
const SHARE_URL = typeof window !== "undefined" ? window.location.origin + window.location.pathname : "";

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

export default function WorldCupResult({ worldcupTitle, champion, roundSize, onRestart, onOtherWorldcups, onHome }) {
  const [shareState, setShareState] = useState("idle");

  const shareText = `🏆 "${worldcupTitle}" ${roundSize}강 이상형 월드컵 우승은 "${champion.label}"! 너도 해봐 👉 ${SHARE_URL}`;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "이상형 월드컵 결과", text: shareText, url: SHARE_URL });
      } catch (err) {
        // 취소 시 무시
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(shareText);
      setShareState("copied");
      setTimeout(() => setShareState("idle"), 2000);
    } catch (err) {
      console.error("공유 텍스트 복사 실패:", err);
    }
  };

  return (
    <div className="deck-result">
      <Confetti />
      <div className="deck-result__card">
        <div className="deck-result__badge">🏆 우승!</div>
        <h2 className="deck-result__deck-title">
          {worldcupTitle} · {roundSize}강
        </h2>

        <img className="wc-result__image" src={champion.image_url} alt={champion.label} />
        <div className="wc-result__label">{champion.label}</div>

        <button className="deck-result__share-btn" onClick={handleShare}>
          {shareState === "copied" ? "✅ 링크가 복사됐어요" : "📤 결과 공유하기"}
        </button>

        <div className="deck-result__actions">
          <button className="deck-result__btn is-primary" onClick={onRestart}>
            다시 하기
          </button>
          <button className="deck-result__btn" onClick={onOtherWorldcups}>
            다른 월드컵 보기
          </button>
          <button className="deck-result__btn is-ghost" onClick={onHome}>
            홈으로
          </button>
        </div>
      </div>
    </div>
  );
}
