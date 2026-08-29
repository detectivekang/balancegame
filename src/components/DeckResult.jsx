import React, { useMemo, useState } from "react";
import { useSession } from "../hooks/useSession";
import AdFitBanner from "./AdFitBanner";
import { generateBalanceShareCard, generateChemistryInviteCard, shareOrDownloadImage, shareImageWithLink } from "../utils/shareCard";

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

export default function DeckResult({
  deckTitle,
  answers,
  xpEarned,
  onRestart,
  onOtherDecks,
  onHome,
  onCreateChemistryLink,
}) {
  const { player, profile } = useSession();
  const persona = pickPersona(answers);
  const minorityCount = useMemo(() => countMinorityPicks(answers), [answers]);
  const [shareState, setShareState] = useState("idle"); // idle | copied
  const [chemistryState, setChemistryState] = useState("idle"); // idle | creating | shared | copied | error

  const shareText = `나는 "${persona.label}"! 🎯 "${deckTitle}" 문제집 결과 확인하고 너도 해봐 👉 ${SHARE_URL}`;
  const minorityText =
    minorityCount > 0 ? `😎 이 중 ${minorityCount}개는 소수의견을 선택했어요!` : null;

  const handleShare = async () => {
    if (shareState === "generating") return;
    setShareState("generating");

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
      const result = await shareOrDownloadImage(blob, "balance-result.png", shareText);
      if (result === "downloaded") {
        setShareState("downloaded");
        setTimeout(() => setShareState("idle"), 2500);
      } else {
        setShareState("idle");
      }
      return;
    }

    // 이미지 생성 자체가 실패한 경우 - 기존 텍스트 공유로 폴백
    if (navigator.share) {
      try {
        await navigator.share({ title: "밸런스게임 결과", text: shareText, url: SHARE_URL });
      } catch (err) {
        // 취소 시 무시
      }
      setShareState("idle");
      return;
    }
    try {
      await navigator.clipboard.writeText(shareText);
      setShareState("copied");
      setTimeout(() => setShareState("idle"), 2000);
    } catch (err) {
      console.error("공유 텍스트 복사 실패:", err);
      setShareState("idle");
    }
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

    const chemistryText = `친구야 나랑 "${deckTitle}" 궁합 테스트 해볼래? 같이 풀고 얼마나 취향 맞는지 보자 👉 ${url}`;

    let blob = null;
    try {
      blob = await generateChemistryInviteCard({
        nickname: profile?.nickname || "친구",
        deckTitle,
        questionCount: answers.length,
      });
    } catch (err) {
      console.error("궁합 초대장 이미지 생성 실패:", err);
    }

    if (blob) {
      const result = await shareImageWithLink(blob, "chemistry-invite.png", chemistryText);
      // shareImageWithLink는 결과와 상관없이 링크를 먼저 클립보드에 복사해두므로,
      // 어떤 경우든 "링크 복사됨"을 알려서 붙여넣어 보내라고 안내함.
      if (result === "shared") {
        setChemistryState("shared-link-copied");
      } else if (result === "downloaded") {
        setChemistryState("downloaded-link-copied");
      } else {
        setChemistryState("link-copied");
      }
      setTimeout(() => setChemistryState("idle"), 3500);
      return;
    }

    // 이미지 생성이 실패한 경우 - 기존 텍스트 공유로 폴백
    if (navigator.share) {
      try {
        await navigator.share({ title: "취향 궁합 테스트", text: chemistryText, url });
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

        <button className="deck-result__share-btn" onClick={handleShare} disabled={shareState === "generating"}>
          {shareState === "generating" && "이미지 만드는 중..."}
          {shareState === "downloaded" && "✅ 이미지 저장됨! 공유해보세요"}
          {shareState === "copied" && "✅ 링크가 복사됐어요"}
          {shareState === "idle" && "📤 결과 공유하기"}
        </button>

        {onCreateChemistryLink && (
          <button
            className="deck-result__chemistry-btn"
            onClick={handleChemistryShare}
            disabled={chemistryState === "creating"}
          >
            {chemistryState === "creating" && "카드 만드는 중..."}
            {chemistryState === "shared-link-copied" && "✅ 링크 복사됨! 사진과 함께 붙여넣어주세요"}
            {chemistryState === "downloaded-link-copied" && "✅ 사진 저장 + 링크 복사됨"}
            {chemistryState === "link-copied" && "✅ 궁합 링크 복사됐어요"}
            {chemistryState === "shared" && "✅ 친구에게 보냈어요"}
            {chemistryState === "downloaded" && "✅ 초대장 저장됨! 공유해보세요"}
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
