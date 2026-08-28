import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import LoadingScreen from "../components/LoadingScreen";

// 로그인 없이도 볼 수 있는 월드컵 결과 카드 페이지 (App.jsx에서 로그인 게이트 밖에 둠).
// 링크를 받은 사람이 "이게 뭐지?" 하고 클릭했을 때 바로 결과부터 보여주고,
// "나도 도전하기"를 누르면 실제 플레이(로그인 필요)로 이어짐.
function ResultLayout({ children }) {
  return (
    <div className="page page--home chemistry-page">
      <div className="chemistry-page__brand">⚖️ 밸런스게임</div>
      {children}
    </div>
  );
}

export default function WorldCupResultPage() {
  const { resultId } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading"); // loading | ready | notfound
  const [result, setResult] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data, error } = await supabase
        .from("worldcup_results")
        .select("*, worldcup:worldcups(id, title), item:worldcup_items(label, image_url)")
        .eq("id", resultId)
        .maybeSingle();

      if (cancelled) return;
      if (error || !data || !data.worldcup || !data.item) {
        setStatus("notfound");
        return;
      }
      setResult(data);
      setStatus("ready");
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [resultId]);

  if (status === "loading") return <LoadingScreen label="결과를 불러오는 중" />;

  if (status === "notfound") {
    return (
      <ResultLayout>
        <p className="empty-state">이 링크는 사용할 수 없어요. (삭제됐거나 잘못된 링크예요)</p>
        <button className="deck-result__btn is-primary" onClick={() => navigate("/")}>
          홈으로
        </button>
      </ResultLayout>
    );
  }

  const nickname = result.sharer_nickname_snapshot || "친구";

  return (
    <ResultLayout>
      <div className="deck-result">
        <div className="deck-result__card">
          <div className="deck-result__badge">🏆 우승 결과</div>
          <h2 className="deck-result__deck-title">{nickname}님의 최종 선택</h2>
          <p className="wc-share__meta">
            "{result.worldcup.title}" · {result.round_size}강
          </p>

          <img className="wc-result__image" src={result.item.image_url} alt={result.item.label} />
          <div className="wc-result__label">{result.item.label}</div>

          <button
            className="deck-result__share-btn"
            onClick={() => navigate(`/worldcup?play=${result.worldcup.id}`)}
          >
            👉 나도 도전하기
          </button>

          <div className="deck-result__actions">
            <button className="deck-result__btn is-ghost" onClick={() => navigate("/")}>
              홈으로
            </button>
          </div>
        </div>
      </div>
    </ResultLayout>
  );
}
