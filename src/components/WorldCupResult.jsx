import React, { useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useSession } from "../hooks/useSession";
import { generateWorldcupShareCard, downloadImage, shareResultCard } from "../utils/shareCard";
import { trackEvent } from "../utils/analytics";

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

  // 결과를 공유함 - 카카오가 설정돼있으면 카드 이미지+링크가 카톡으로 바로 가고,
  // 아니면 이미지 없이 링크만 확실하게 보냄(이미지+텍스트를 같이 보내면 일부
  // 공유 대상이 텍스트=링크를 버려서 "그냥 홈 화면만 뜬다"는 문제가 있었음).
  // 사진 자체가 필요한 사람은 아래 별도의 "이미지로 저장" 버튼을 씀.
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

      const url = `${window.location.origin}${window.location.pathname}#/worldcup/result/${data.id}`;
      const text = `🏆 "${worldcupTitle}" ${roundSize}강 이상형 월드컵 우승은 "${champion.label}"! 너도 해봐`;

      const result = await shareResultCard(
        supabase,
        () => generateWorldcupShareCard({ worldcupTitle, roundSize, championLabel: champion.label, championImageUrl: champion.image_url }),
        "worldcup-result.png",
        {
          title: `이상형 월드컵 - "${champion.label}" 우승!`,
          description: text,
          linkUrl: url,
          buttonLabel: "나도 도전하기",
        }
      );
      trackEvent("share", { method: result, content_type: "worldcup_result" });
      setLinkState(result === "link-copied" ? "copied" : result);
    } catch (err) {
      console.error("결과 링크 생성 실패:", err);
      setLinkState("idle");
    }
    setTimeout(() => setLinkState("idle"), 3000);
  };

  // 인스타 스토리 등에 올리고 싶은 사람들을 위한 보조 옵션 - 항상 실제로 파일 다운로드됨
  // (공유 시트가 뜨면 "저장 버튼인데 왜 공유창이 뜨냐"는 혼란을 주므로 결정적으로 다운로드만 함).
  const handleSaveImage = async () => {
    if (imageState === "generating") return;
    setImageState("generating");

    try {
      const blob = await generateWorldcupShareCard({
        worldcupTitle,
        roundSize,
        championLabel: champion.label,
        championImageUrl: champion.image_url,
      });
      downloadImage(blob, "worldcup-result.png");
      setImageState("downloaded");
    } catch (err) {
      console.error("공유 카드 이미지 생성 실패:", err);
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
          {linkState === "creating" && "여는 중..."}
          {linkState === "kakao" && "✅ 카카오톡으로 보냈어요"}
          {linkState === "shared" && "✅ 친구에게 보냈어요"}
          {linkState === "copied" && "✅ 결과 링크 복사됐어요"}
          {linkState === "error" && "⚠️ 실패했어요, 다시 시도해주세요"}
          {(linkState === "idle" || !linkState) && "📤 결과 공유하기"}
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
