import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const PAGE_SIZE = 30;

// 마이페이지의 "총 참여 문제" 숫자를 눌렀을 때 뜨는 간단한 내 투표 결과 화면.
// 최근 투표한 문제들을 최신순으로 보여주고, 내가 고른 쪽과 현재 전체 득표율을 표시함.
export default function MyVotesModal({ userId, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [votes, setVotes] = useState([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data, error } = await supabase
        .from("votes")
        .select(
          "choice, created_at, question:questions(question, option_a, option_b, votes_a, votes_b, category)"
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);

      if (cancelled) return;
      if (error) {
        console.error("내 투표 내역 로딩 실패:", error);
        setError("내역을 불러오지 못했어요.");
      } else {
        // 삭제된 문제 등으로 question이 비어있는 항목은 제외
        setVotes((data || []).filter((v) => v.question));
      }
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <div className="votes-modal__backdrop" onClick={onClose}>
      <div className="votes-modal__card" onClick={(e) => e.stopPropagation()}>
        <div className="votes-modal__header">
          <h3>📊 내가 투표한 문제</h3>
          <button type="button" className="votes-modal__close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>

        {loading && <p className="votes-modal__status">불러오는 중...</p>}
        {!loading && error && <p className="votes-modal__status">⚠️ {error}</p>}
        {!loading && !error && votes.length === 0 && (
          <p className="votes-modal__status">아직 투표한 문제가 없어요.</p>
        )}

        {!loading && !error && votes.length > 0 && (
          <>
            <p className="votes-modal__hint">
              최근 {votes.length}개 · 막대는 지금 기준 전체 참여자 결과예요
            </p>
            <div className="votes-modal__list">
              {votes.map((v, i) => {
                const q = v.question;
                const total = (q.votes_a || 0) + (q.votes_b || 0);
                const pctA = total > 0 ? Math.round((q.votes_a / total) * 100) : 0;
                const pctB = total > 0 ? 100 - pctA : 0;
                const pickedA = v.choice === "A";

                return (
                  <div key={i} className="votes-modal__item">
                    <div className="votes-modal__question">{q.question}</div>

                    <div className={`votes-modal__bar-row ${pickedA ? "is-picked" : ""}`}>
                      <span className="votes-modal__bar-label">
                        {pickedA && "👉 "}
                        {q.option_a}
                      </span>
                      <div className="votes-modal__bar-track">
                        <div className="votes-modal__bar-fill is-a" style={{ width: `${pctA}%` }} />
                      </div>
                      <span className="votes-modal__bar-pct">{pctA}%</span>
                    </div>

                    <div className={`votes-modal__bar-row ${!pickedA ? "is-picked" : ""}`}>
                      <span className="votes-modal__bar-label">
                        {!pickedA && "👉 "}
                        {q.option_b}
                      </span>
                      <div className="votes-modal__bar-track">
                        <div className="votes-modal__bar-fill is-b" style={{ width: `${pctB}%` }} />
                      </div>
                      <span className="votes-modal__bar-pct">{pctB}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
