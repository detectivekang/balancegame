import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useSession } from "../hooks/useSession";

export default function BalanceCard({ q, onNext, onVoted, nextLabel = "다음 문제 →" }) {
  const { user, castVote } = useSession();
  const [choice, setChoice] = useState(null);
  const [votesA, setVotesA] = useState(q.votes_a || 0);
  const [votesB, setVotesB] = useState(q.votes_b || 0);
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // 이 문제에 이미 투표했는지 서버에서 확인 (실제 로그인 기반이라 기기가 바뀌어도 정확함)
  useEffect(() => {
    let cancelled = false;
    supabase
      .from("votes")
      .select("choice")
      .eq("question_id", q.id)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (data) setChoice(data.choice);
        setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [q.id, user.id]);

  const voted = Boolean(choice);
  const totalVotes = votesA + votesB;
  const percentA = totalVotes > 0 ? Math.round((votesA / totalVotes) * 100) : 50;
  const percentB = 100 - percentA;

  const vote = async (side) => {
    if (voted || submitting) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const result = await castVote(q.id, side);
      setVotesA(result.votes_a);
      setVotesB(result.votes_b);
      setChoice(side);
      onVoted && onVoted(side, result.votes_a, result.votes_b);
    } catch (err) {
      console.error("투표 반영 실패:", err);
      // 서버 함수(cast_vote)가 던지는 대표적인 원인들을 사람이 읽을 수 있는 메시지로 변환
      const raw = err?.message || "";
      let friendly = "투표에 실패했어요. 잠시 후 다시 시도해주세요.";
      if (raw.includes("not enough energy")) friendly = "에너지가 부족해요! 잠시 후 다시 시도해주세요.";
      else if (raw.includes("question not available"))
        friendly = "이 문제는 아직 승인되지 않았거나 삭제됐어요.";
      else if (raw.includes("not authenticated")) friendly = "로그인이 만료됐어요. 다시 로그인해주세요.";
      else if (raw.includes("duplicate key")) friendly = "이미 투표한 문제예요.";
      setErrorMsg(friendly);
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return <div className="balance-card balance-card--loading">불러오는 중...</div>;
  }

  return (
    <div className="balance-card">
      <div className="balance-card__category">{q.category}</div>
      <h3 className="balance-card__question">{q.question}</h3>

      {errorMsg && <p className="balance-card__error">⚠️ {errorMsg}</p>}

      {!voted && (
        <div className="balance-card__options">
          <button className="balance-card__option opt-a" onClick={() => vote("A")} disabled={submitting}>
            {q.option_a}
          </button>
          <div className="balance-card__vs">VS</div>
          <button className="balance-card__option opt-b" onClick={() => vote("B")} disabled={submitting}>
            {q.option_b}
          </button>
        </div>
      )}

      {voted && (
        <div className="balance-result balance-result--reveal">
          <div className="balance-result__row">
            <div className="balance-result__labels">
              <span>{q.option_a}</span>
              <span className="balance-result__percent">{percentA}%</span>
            </div>
            <div className="balance-result__track">
              <div
                className={`balance-result__fill opt-a ${choice === "A" ? "is-my-choice" : ""}`}
                style={{ width: `${percentA}%` }}
              />
            </div>
          </div>

          <div className="balance-result__row">
            <div className="balance-result__labels">
              <span>{q.option_b}</span>
              <span className="balance-result__percent">{percentB}%</span>
            </div>
            <div className="balance-result__track">
              <div
                className={`balance-result__fill opt-b ${choice === "B" ? "is-my-choice" : ""}`}
                style={{ width: `${percentB}%` }}
              />
            </div>
          </div>

          <p className="balance-result__meta">
            지금까지 <b>{totalVotes.toLocaleString()}명</b> 참여했어요 (+1 XP)
          </p>
        </div>
      )}

      <button className="balance-card__next" onClick={onNext}>
        {nextLabel}
      </button>
    </div>
  );
}
