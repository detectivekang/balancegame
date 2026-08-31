import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import LoadingScreen from "../components/LoadingScreen";

// 로그인 없이도 볼 수 있는 밸런스게임 결과 카드 페이지 (App.jsx에서 로그인 게이트 밖에 둠).
// 월드컵 결과 카드(WorldCupResultPage)와 동일한 패턴.
function ResultLayout({ children }) {
  return (
    <div className="page page--home chemistry-page">
      <div className="chemistry-page__brand">⚖️ 밸런스게임</div>
      {children}
    </div>
  );
}

export default function BalanceResultPage() {
  const { resultId } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading"); // loading | ready | notfound
  const [result, setResult] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data, error } = await supabase
        .from("balance_results")
        .select("*")
        .eq("id", resultId)
        .maybeSingle();

      if (cancelled) return;
      if (error || !data) {
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
  // set_id가 있으면 실제 문제집 id, 없으면 카테고리 폴백 가상 문제집 id 형식(fallback-카테고리)으로
  // Home.jsx의 ?play= 파라미터에 그대로 넘겨서 같은 문제집을 바로 시작하게 함.
  const playId = result.set_id || (result.category ? `fallback-${result.category}` : null);

  return (
    <ResultLayout>
      <div className="deck-result">
        <div className="deck-result__card">
          <div className="deck-result__badge">🎯 밸런스게임 결과</div>
          <h2 className="deck-result__deck-title">{result.deck_title}</h2>
          <p className="wc-share__meta">{nickname}님의 결과</p>

          <div className="deck-result__persona">{result.persona_label}</div>
          {result.persona_desc && <p className="deck-result__desc">{result.persona_desc}</p>}

          {result.minority_count > 0 && (
            <p className="deck-result__minority">
              😎 이 중 <b>{result.minority_count}개</b>는 소수의견을 선택했대요 — 남다른 취향이네요!
            </p>
          )}

          {playId && (
            <button
              className="deck-result__share-btn"
              onClick={() => navigate(`/?play=${encodeURIComponent(playId)}`)}
            >
              👉 나도 해볼래?
            </button>
          )}

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
