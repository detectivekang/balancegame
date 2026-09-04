import React, { useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useSession } from "../hooks/useSession";
import { generateWorldcupShareCard, shareOrDownloadImage } from "../utils/shareCard";

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

export default function WorldCupResult({ worldcupId, worldcupTitle, champion, roundSize, onRestart, onOtherWorldcups, onHome }) {
  const { profile } = useSession();
  const [linkState, setLinkState] = useState("idle"); // idle | creating | shared | copied
  const [imageState, setImageState] = useState("idle"); // idle | generating | downloaded

  // 결과를 링크로 공유 - 받는 사람이 정적 이미지 한 장만 보고 끝나는 게 아니라,
  // 클릭하면 결과 카드 페이지가 뜨고 거기서 바로 "나도 도전하기"로 이어지게 함.
  const handleShareLink = async () => {
    if (linkState === "creating") return;
    setLinkState("creating");

    try {
      const { data, error } = await supabase
        .from("worldcup_results")
        .insert({
          worldcup_id: worldcupId,
          champion_item_id: champion.id,
          round_size: roundSize,
          sharer_id: profile?.id || null,
          sharer_nickname_snapshot: profile?.nickname || "친구",
        })
        .select()
        .single();
      if (error) throw error;

      // 결과 페이지로 바로 가는 링크를 텍스트와 함께 공유 (간단하게: 게임명 - 제목 + 링크)
      const url = `https://detectivekang.github.io/balancegame/worldcup/?id=${data.id}`;
      const text = `이상형월드컵 - "${worldcupTitle}"\n${url}`;

      if (navigator.share) {
        try {
          await navigator.share({ title: "이상형 월드컵 결과", text, url });
          setLinkState("shared");
        } catch (err) {
          setLinkState("idle");
        }
      } else {
        await navigator.clipboard.writeText(text);
        setLinkState("copied");
      }
    } catch (err) {
      console.error("결과 링크 생성 실패:", err);
      setLinkState("idle");
    }
    setTimeout(() => setLinkState("idle"), 2500);
  };

  // 인스타 스토리 등에 올리고 싶은 사람들을 위한 보조 옵션 - 이미지 한 장 저장/공유.
  const handleSaveImage = async () => {
    if (imageState === "generating") return;
    setImageState("generating");

    let blob = null;
    try {
      blob = await generateWorldcupShareCard({
        worldcupTitle,
        roundSize,
        championLabel: champion.label,
        championImageUrl: champion.image_url,
      });
    } catch (err) {
      console.error("공유 카드 이미지 생성 실패:", err);
    }

    if (blob) {
      const result = await shareOrDownloadImage(blob, "worldcup-result.png", `"${champion.label}"이 우승했어요!`);
      setImageState(result === "downloaded" ? "downloaded" : "idle");
    } else {
      setImageState("idle");
    }
    setTimeout(() => setImageState("idle"), 2500);
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

        <button className="deck-result__share-btn" onClick={handleShareLink} disabled={linkState === "creating"}>
          {linkState === "creating" && "결과 카드 만드는 중..."}
          {linkState === "shared" && "✅ 친구에게 보냈어요"}
          {linkState === "copied" && "✅ 결과 링크가 복사됐어요"}
          {(linkState === "idle" || !linkState) && "📤 결과 공유하기 (링크)"}
        </button>

        <button className="wc-result__image-btn" onClick={handleSaveImage} disabled={imageState === "generating"}>
          {imageState === "generating" && "이미지 만드는 중..."}
          {imageState === "downloaded" && "✅ 이미지 저장됨"}
          {(imageState === "idle" || !imageState) && "🖼️ 이미지로 저장 (인스타 스토리용)"}
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
