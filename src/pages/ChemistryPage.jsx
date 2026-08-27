import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useSession } from "../hooks/useSession";
import BalanceCard from "../components/BalanceCard";
import DeckProgress from "../components/DeckProgress";
import ChemistryResult from "../components/ChemistryResult";
import PlayerStatusBar from "../components/PlayerStatusBar";
import EnergyEmpty from "../components/EnergyEmpty";
import LoadingScreen from "../components/LoadingScreen";

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function ChemistryPage() {
  const { resultId } = useParams();
  const navigate = useNavigate();
  const { player, profile } = useSession();

  const [status, setStatus] = useState("loading"); // loading | intro | playing | result | notfound
  const [invite, setInvite] = useState(null); // { setId, deckTitle, nickname, answers }
  const [queue, setQueue] = useState([]);
  const [index, setIndex] = useState(0);
  const [myAnswers, setMyAnswers] = useState([]);
  const [linkState, setLinkState] = useState("idle");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: result, error } = await supabase
        .from("chemistry_results")
        .select("*")
        .eq("id", resultId)
        .maybeSingle();

      if (cancelled) return;
      if (error || !result || !result.set_id) {
        setStatus("notfound");
        return;
      }

      const { data: set } = await supabase
        .from("question_sets")
        .select("title")
        .eq("id", result.set_id)
        .maybeSingle();

      const { data: questions } = await supabase
        .from("questions")
        .select("*")
        .eq("set_id", result.set_id)
        .eq("status", "approved");

      if (cancelled) return;
      if (!questions || questions.length === 0) {
        setStatus("notfound");
        return;
      }

      setInvite({
        setId: result.set_id,
        deckTitle: set?.title || "밸런스게임",
        nickname: result.nickname_snapshot || "친구",
        answers: result.answers || [],
        questions,
      });
      setStatus("intro");
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [resultId]);

  const startPlaying = () => {
    setQueue(shuffle(invite.questions));
    setIndex(0);
    setMyAnswers([]);
    setStatus("playing");
  };

  const handleVoted = (side, votesA, votesB, questionId) => {
    setMyAnswers((prev) => [...prev, { questionId, side }]);
  };

  const handleNext = () => {
    if (index + 1 >= queue.length) {
      setStatus("result");
    } else {
      setIndex((i) => i + 1);
    }
  };

  const { matched, total } = React.useMemo(() => {
    if (!invite) return { matched: 0, total: 0 };
    const originalMap = new Map(invite.answers.map((a) => [a.question_id, a.choice]));
    let m = 0;
    let t = 0;
    myAnswers.forEach((a) => {
      if (originalMap.has(a.questionId)) {
        t += 1;
        if (originalMap.get(a.questionId) === a.side) m += 1;
      }
    });
    return { matched: m, total: t };
  }, [invite, myAnswers]);

  const percent = total > 0 ? Math.round((matched / total) * 100) : 0;

  const handleCreateNextLink = async () => {
    setLinkState("creating");
    try {
      const payload = myAnswers.map((a) => ({ question_id: a.questionId, choice: a.side }));
      const { data, error } = await supabase
        .from("chemistry_results")
        .insert({
          set_id: invite.setId,
          user_id: profile?.id || null,
          nickname_snapshot: profile?.nickname || "친구",
          answers: payload,
        })
        .select()
        .single();
      if (error) throw error;

      const url = `${window.location.origin}${window.location.pathname}#/chemistry/${data.id}`;
      const text = `친구야 나랑 "${invite.deckTitle}" 궁합 테스트 해볼래? 👉 ${url}`;

      if (navigator.share) {
        try {
          await navigator.share({ title: "취향 궁합 테스트", text, url });
          setLinkState("shared");
        } catch (err) {
          setLinkState("idle");
        }
      } else {
        await navigator.clipboard.writeText(text);
        setLinkState("copied");
      }
    } catch (err) {
      console.error("궁합 링크 생성 실패:", err);
      setLinkState("idle");
    }
    setTimeout(() => setLinkState("idle"), 2500);
  };

  if (status === "loading") return <LoadingScreen label="궁합 테스트를 불러오는 중" />;

  if (status === "notfound") {
    return (
      <div className="page page--home">
        <p className="empty-state">이 링크는 사용할 수 없어요. (만료됐거나 잘못된 링크예요)</p>
        <button className="deck-result__btn is-primary" onClick={() => navigate("/")}>
          홈으로
        </button>
      </div>
    );
  }

  const energyEmpty = player && player.currentEnergy <= 0 && !player.isPremium;

  if (status === "intro") {
    return (
      <div className="page page--home">
        <div className="chemistry-intro">
          <div className="chemistry-intro__icon">👯</div>
          <h2>{invite.nickname}님이 궁합 테스트에 초대했어요!</h2>
          <p>
            "{invite.deckTitle}" 문제집을 같이 풀고
            <br />
            취향이 얼마나 비슷한지 확인해봐요.
          </p>
          <button className="deck-result__btn is-primary" onClick={startPlaying}>
            시작하기
          </button>
        </div>
      </div>
    );
  }

  if (status === "playing") {
    const current = queue[index];
    const isLast = index + 1 >= queue.length;
    return (
      <div className="page page--home">
        <PlayerStatusBar />
        <DeckProgress title={`${invite.nickname}님과 궁합`} current={index} total={queue.length} onExit={() => navigate("/")} />
        {energyEmpty && <EnergyEmpty />}
        {!energyEmpty && current && (
          <BalanceCard
            key={current.id}
            q={current}
            onNext={handleNext}
            onVoted={handleVoted}
            nextLabel={isLast ? "궁합 결과 보기 👯" : "다음 문제 →"}
          />
        )}
      </div>
    );
  }

  return (
    <div className="page page--home">
      <ChemistryResult
        partnerName={invite.nickname}
        percent={percent}
        matched={matched}
        total={total}
        onCreateLink={handleCreateNextLink}
        onHome={() => navigate("/")}
        linkState={linkState}
      />
    </div>
  );
}
