import React, { useMemo, useState } from "react";
import { useSession } from "../hooks/useSession";
import AdFitBanner from "./AdFitBanner";
import { pickPersona, countMinorityPicks } from "../utils/persona";
import { generateBalanceShareCard, shareOrDownloadImage } from "../utils/shareCard";

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
  xpEarned,
  onRestart,
  onOtherDecks,
  onHome,
  onCreateShareLink,
  onCreateChemistryLink,
}) {
  const { player } = useSession();
  const persona = pickPersona(answers);
  const minorityCount = useMemo(() => countMinorityPicks(answers), [answers]);
  const [linkState, setLinkState] = useState("idle"); // idle | creating | shared | copied | error
  const [imageState, setImageState] = useState("idle"); // idle | generating | downloaded
  const [chemistryState, setChemistryState] = useState("idle"); // idle | creating | shared | copied | error

  // 인스타 스토리 등에 올리고 싶은 사람들을 위한 보조 옵션 - 이미지 한 장 저장/공유.
  const minorityText = minorityCount > 0 ? `😎 이 중 ${minorityCount}개는 소수의견을 선택했어요!` : null;

  const handleSaveImage = async () => {
    if (imageState === "generating") return;
    setImageState("generating");

    let blob = null;
    try {
      blob = await generateBalanceShareCard({
        deckTitle,
        personaLabel: persona.label,
        personaDesc: persona.desc,
        minorityText,
        xpEarned,
      });
    } catch (err) {
      console.error("공유 카드 이미지 생성 실패:", err);
    }

    if (blob) {
      const result = await shareOrDownloadImage(blob, "balance-result.png", `나는 "${persona.label}"!`);
      setImageState(result === "downloaded" ? "downloaded" : "idle");
    } else {
      setImageState("idle");
    }
    setTimeout(() => setImageState("idle"), 2500);
  };

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

    if (navigator.share) {
      try {
        // 링크는 이미 text 안에 포함돼 있으니 url은 따로 넘기지 않는다.
        await navigator.share({ title: "취향 궁합 테스트", text: chemistryText });
        setChemistryState("shared");
      } catch (err) {
        setChemistryState("idle");
      }
      setTimeout(() => setChemistryState("idle"), 2000);
      return;
    }

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
        <div className="deck-result__persona">{persona.label}</div>
        <p className="deck-result__desc">{persona.desc}</p>

        {minorityCount > 0 && (
          <p className="deck-result__minority">
            😎 이 중 <b>{minorityCount}개</b>는 소수의견을 선택했어요 — 남다른 취향이네요!
          </p>
        )}

        <p className="deck-result__xp">+{xpEarned} XP 획득!</p>

        <button className="wc-result__image-btn" onClick={handleSaveImage} disabled={imageState === "generating"}>
          {imageState === "generating" && "이미지 만드는 중..."}
          {imageState === "downloaded" && "✅ 이미지 저장됨"}
          {(imageState === "idle" || !imageState) && "🖼️ 이미지로 저장 (인스타 스토리용)"}
        </button>

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
