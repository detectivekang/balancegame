import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useSession } from "../hooks/useSession";

export default function BalanceCard({ q, onNext, onVoted, nextLabel = "다음 문제 →" }) {
  const { user, castVote } = useSession();
  const [choice, setChoice] = useState(null); // 이번 플레이에서 고른 선택
  const [previousChoice, setPreviousChoice] = useState(null); // 예전에 이 문제에 골랐던 선택 (있으면)
  const [votesA, setVotesA] = useState(q.votes_a || 0);
  const [votesB, setVotesB] = useState(q.votes_b || 0);
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // 예전에 이 문제에 투표한 적 있는지 확인해서 "이전 선택" 안내용으로만 저장.
  // (예전 투표가 있어도 화면은 바로 결과로 넘기지 않고 다시 풀 수 있게 함)
  useEffect(() => {
    let cancelled = false;
    setChecking(true);
    setChoice(null);
    setPreviousChoice(null);
    setVotesA(q.votes_a || 0);
    setVotesB(q.votes_b || 0);
    setErrorMsg(null);

    supabase
      .from("votes")
      .select("choice")
      .eq("question_id", q.id)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (data) setPreviousChoice(data.choice);
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

    // 이미 예전에 투표한 문제를 다시 만난 경우 - XP/에너지는 다시 지급하지 않고
    // "다시 풀어보기" 용도로만 최신 통계를 보여줌 (중복 집계 방지)
    if (previousChoice) {
      try {
        const { data, error } = await supabase
          .from("questions")
          .select("votes_a, votes_b")
          .eq("id", q.id)
          .single();
        if (!error && data) {
          setVotesA(data.votes_a);
          setVotesB(data.votes_b);
        }
      } catch (err) {
        console.error("최신 통계 조회 실패:", err);
      }
      setChoice(side);
      setSubmitting(false);
      return;
    }

    try {
      const result = await castVote(q.id, side);
      setVotesA(result.votes_a);
      setVotesB(result.votes_b);
      setChoice(side);
      onVoted && onVoted(side, result.votes_a, result.votes_b, q.id);
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
    return (
      <div className="balance-card balance-card--loading">
        <div className="balance-card__loading-spinner" />
      </div>
    );
  }

  const previousChoiceLabel = previousChoice === "A" ? q.option_a : previousChoice === "B" ? q.option_b : null;

  return (
    <div className="balance-card">
      <div className="balance-card__category">{q.category}</div>

      {previousChoice && !voted && (
        <div className="balance-card__replay-badge">🔁 예전에 풀어본 문제예요</div>
      )}

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
            지금까지 <b>{totalVotes.toLocaleString()}명</b> 참여했어요{!previousChoice && " (+1 XP)"}
          </p>

          {previousChoiceLabel && (
            <p className="balance-result__previous">
              📌 예전엔 <b>"{previousChoiceLabel}"</b>을 선택했었어요
              {previousChoice === choice ? " — 이번에도 같은 선택! 취향 확고하네요 😎" : " — 이번엔 마음이 바뀌었네요!"}
            </p>
          )}
        </div>
      )}

      <button className="balance-card__next" onClick={onNext}>
        {nextLabel}
      </button>
    </div>
  );
}
