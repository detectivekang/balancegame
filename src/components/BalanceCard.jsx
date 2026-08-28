import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useSession } from "../hooks/useSession";
import ReportButton from "./ReportButton";

export default function BalanceCard({
  q,
  onNext,
  onVoted,
  nextLabel = "다음 문제 →",
  recordVote = true, // false면 궁합 테스트처럼 에너지/XP 차감 및 전역 투표 기록 없이 로컬로만 채점
}) {
  const { user, castVote } = useSession();
  const [choice, setChoice] = useState(null); // 이번 플레이에서 고른 선택
  const [previousChoice, setPreviousChoice] = useState(null); // 예전에 이 문제에 골랐던 선택 (있으면)
  const [votesA, setVotesA] = useState(q.votes_a || 0);
  const [votesB, setVotesB] = useState(q.votes_b || 0);
  const [checking, setChecking] = useState(recordVote);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // 예전에 이 문제에 투표한 적 있는지 확인해서 "이전 선택" 안내용으로만 저장.
  // (예전 투표가 있어도 화면은 바로 결과로 넘기지 않고 다시 풀 수 있게 함)
  // recordVote=false(궁합 테스트 등)일 때는 실제 투표를 기록하지 않으므로 조회도 건너뜀.
  useEffect(() => {
    if (!recordVote) return;
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
  }, [q.id, user.id, recordVote]);

  const voted = Boolean(choice);
  const totalVotes = votesA + votesB;
  const percentA = totalVotes > 0 ? Math.round((votesA / totalVotes) * 100) : 50;
  const percentB = 100 - percentA;

  const vote = async (side) => {
    if (voted || submitting) return;

    // 궁합 테스트 등 recordVote=false 모드: 에너지도 안 쓰고 전역 투표에도 반영하지
    // 않음. 이번 선택만 로컬로 기록해서 채점(onVoted)에 쓰고 끝.
    if (!recordVote) {
      setChoice(side);
      onVoted && onVoted(side, votesA, votesB, q.id);
      return;
    }

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
      let knownCause = true;
      if (raw.includes("not enough energy")) friendly = "에너지가 부족해요! 잠시 후 다시 시도해주세요.";
      else if (raw.includes("question not available"))
        friendly = "이 문제는 아직 승인되지 않았거나 삭제됐어요.";
      else if (raw.includes("not authenticated")) friendly = "로그인이 만료됐어요. 다시 로그인해주세요.";
      else if (raw.includes("duplicate key")) friendly = "이미 투표한 문제예요.";
      else knownCause = false;
      // 알려진 원인이 아니면(서버쪽 실제 오류일 가능성) 원인 텍스트도 같이 보여줘서
      // 나중에 캡처해서 문의하기 쉽게 함
      setErrorMsg(knownCause || !raw ? friendly : `${friendly} (${raw})`);
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
      <div className="balance-card__top">
        <div className="balance-card__category">{q.category}</div>
        <ReportButton
          className="balance-card__report"
          label="🚩 신고"
          target={{ type: "question", id: q.id, label: q.question }}
        />
      </div>

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
            지금까지 <b>{totalVotes.toLocaleString()}명</b> 참여했어요{recordVote && !previousChoice && " (+1 XP)"}
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
