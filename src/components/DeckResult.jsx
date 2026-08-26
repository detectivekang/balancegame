import React, { useMemo, useState } from "react";
import { useSession } from "../hooks/useSession";
import AdFitBanner from "./AdFitBanner";

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

function pickPersona(answers) {
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
function countMinorityPicks(answers) {
  return answers.filter((a) => {
    const total = a.votesA + a.votesB;
    if (!total) return false;
    const myVotes = a.side === "A" ? a.votesA : a.votesB;
    return myVotes / total < 0.5;
  }).length;
}

export default function DeckResult({ deckTitle, answers, xpEarned, onRestart, onOtherDecks, onHome }) {
  const { player } = useSession();
  const persona = pickPersona(answers);
  const minorityCount = useMemo(() => countMinorityPicks(answers), [answers]);
  const [shareState, setShareState] = useState("idle"); // idle | copied

  const shareText = `나는 "${persona.label}"! 🎯 "${deckTitle}" 문제집 결과 확인하고 너도 해봐 👉 ${SHARE_URL}`;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "밸런스게임 결과", text: shareText, url: SHARE_URL });
      } catch (err) {
        // 사용자가 공유를 취소한 경우 등은 조용히 무시
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
        <div className="deck-result__badge">🎉 문제집 완료!</div>
        <h2 className="deck-result__deck-title">{deckTitle}</h2>
        <div className="deck-result__persona">{persona.label}</div>
        <p className="deck-result__desc">{persona.desc}</p>

        {minorityCount > 0 && (
          <p className="deck-result__minority">
            😎 이 중 <b>{minorityCount}개</b>는 소수의견을 선택했어요 — 남다른 취향이네요!
          </p>
        )}

        <p className="deck-result__xp">+{xpEarned} XP 획득!</p>

        <button className="deck-result__share-btn" onClick={handleShare}>
          {shareState === "copied" ? "✅ 링크가 복사됐어요" : "📤 결과 공유하기"}
        </button>

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
