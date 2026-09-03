import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useSession } from "../hooks/useSession";
import { generateChemistryInviteCard, shareChemistryInvite } from "../utils/shareCard";
import { trackEvent } from "../utils/analytics";
import BalanceCard from "../components/BalanceCard";
import DeckProgress from "../components/DeckProgress";
import ChemistryResult from "../components/ChemistryResult";
import PlayerStatusBar from "../components/PlayerStatusBar";
import LoadingScreen from "../components/LoadingScreen";

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const PENDING_KEY_PREFIX = "chemistry-pending-";

// 로그인 없이도 볼 수 있는 작은 브랜드 바 - 이 페이지는 App.jsx에서 로그인 게이트
// 밖에 있어서(초대받은 친구가 로그인 전에도 열 수 있어야 하므로) Header가 없음.
function ChemistryLayout({ children }) {
  return (
    <div className="page page--home chemistry-page">
      <div className="chemistry-page__brand">⚖️ 밸런스게임</div>
      {children}
    </div>
  );
}

export default function ChemistryPage() {
  const { resultId } = useParams();
  const navigate = useNavigate();
  const { user, profile, signInWithKakao } = useSession();

  const [status, setStatus] = useState("loading"); // loading | intro | playing | result | notfound
  const [invite, setInvite] = useState(null); // { setId, deckTitle, nickname, answers, questions }
  const [queue, setQueue] = useState([]);
  const [index, setIndex] = useState(0);
  const [myAnswers, setMyAnswers] = useState([]);
  const [linkState, setLinkState] = useState("idle");
  const [groupBoard, setGroupBoard] = useState([]); // 같은 초대에 응답한 모두의 결과 (그룹 순위)
  const [myMatchId, setMyMatchId] = useState(null);
  const [groupShareState, setGroupShareState] = useState("idle");
  const [detailUnlocked, setDetailUnlocked] = useState(false); // 로그인해서 상세 결과 볼 수 있는 상태
  const [detailPending, setDetailPending] = useState(false); // "상세 결과 보기" 눌러서 로그인하러 가는 중
  const matchSavedRef = useRef(false); // 궁합 결과를 이미 저장했는지 (중복 저장 방지)
  const restoredRef = useRef(false); // 로그인 후 복귀 시 임시저장 답변을 이미 복원했는지

  const pendingKey = `${PENDING_KEY_PREFIX}${resultId}`;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: result, error } = await supabase
        .from("chemistry_results")
        .select("*")
        .eq("id", resultId)
        .maybeSingle();

      if (cancelled) return;
      if (error || !result || (!result.set_id && !result.category)) {
        setStatus("notfound");
        return;
      }

      let deckTitle = "밸런스게임";
      let questions;

      if (result.set_id) {
        const { data: set } = await supabase
          .from("question_sets")
          .select("title")
          .eq("id", result.set_id)
          .maybeSingle();
        deckTitle = set?.title || deckTitle;

        const { data } = await supabase
          .from("questions")
          .select("*")
          .eq("set_id", result.set_id)
          .eq("status", "approved");
        questions = data;
      } else {
        // 폴백 가상 문제집("OO 모음집") - 아직 set에 안 묶인 그 카테고리 문제들을 다시 찾아옴
        deckTitle = `${result.category} 모음집`;

        const { data } = await supabase
          .from("questions")
          .select("*")
          .eq("category", result.category)
          .eq("status", "approved")
          .is("set_id", null);
        questions = data;
      }

      if (cancelled) return;
      if (!questions || questions.length === 0) {
        setStatus("notfound");
        return;
      }

      setInvite({
        setId: result.set_id,
        deckTitle,
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

  // 카카오 로그인은 페이지 전체가 이동했다 돌아오는 방식이라 React state가 다 날아감.
  // "상세 결과 보기" 누르기 직전에 sessionStorage에 저장해둔 답변이 있으면 복원해서,
  // 로그인하고 돌아온 친구가 처음부터 다시 풀지 않고 바로 결과로 이어지게 함.
  useEffect(() => {
    if (!invite || restoredRef.current) return;
    restoredRef.current = true;
    try {
      const raw = sessionStorage.getItem(pendingKey);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved?.answers?.length > 0) {
          setMyAnswers(saved.answers);
          setStatus("result");
          if (user) setDetailUnlocked(true);
        }
      }
    } catch (err) {
      console.error("저장된 궁합 답변 복원 실패:", err);
    } finally {
      sessionStorage.removeItem(pendingKey);
    }
  }, [invite, user, pendingKey]);

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

  const { matched, total } = useMemo(() => {
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

  // 테스트를 다 풀어서 %가 무료 공개되는 순간 (로그인 여부와 무관 - 이 시점엔
  // 아직 비로그인 상태일 수 있음, 그래서 chemistry_matches insert와는 별개로 여기서 남김)
  const testCompleteTrackedRef = useRef(false);
  useEffect(() => {
    if (status !== "result" || testCompleteTrackedRef.current || total === 0) return;
    testCompleteTrackedRef.current = true;
    trackEvent("chemistry_test_complete", { deck_title: invite?.deckTitle, percent, logged_in: Boolean(user) });
  }, [status, total, percent, invite, user]);

  // 문제별 상세 비교 목록 (상세 결과 보기 - 로그인해야 볼 수 있음)
  const detailItems = useMemo(() => {
    if (!invite) return [];
    const originalMap = new Map(invite.answers.map((a) => [a.question_id, a.choice]));
    const myMap = new Map(myAnswers.map((a) => [a.questionId, a.side]));
    return invite.questions
      .filter((q) => originalMap.has(q.id) && myMap.has(q.id))
      .map((q) => {
        const theirChoice = originalMap.get(q.id);
        const myChoice = myMap.get(q.id);
        return {
          id: q.id,
          question: q.question,
          myLabel: myChoice === "A" ? q.option_a : q.option_b,
          theirLabel: theirChoice === "A" ? q.option_a : q.option_b,
          isMatch: myChoice === theirChoice,
        };
      });
  }, [invite, myAnswers]);

  // "상세 결과 보기"를 실제로 열람(=로그인된 상태로 unlocked)했을 때만 결과를 저장함.
  // 익명으로 %만 보고 나간 방문자는 기록하지 않고, 로그인해서 제대로 참여한 사람만
  // 초대한 사람의 마이페이지에 남도록 함.
  useEffect(() => {
    if (!detailUnlocked || matchSavedRef.current || total === 0) return;
    matchSavedRef.current = true;
    trackEvent("chemistry_detail_unlock", { deck_title: invite?.deckTitle, percent });

    supabase
      .from("chemistry_matches")
      .insert({
        chemistry_result_id: resultId,
        respondent_user_id: user?.id || null,
        respondent_nickname: profile?.nickname || "친구",
        matched,
        total,
        percent,
      })
      .select()
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.error("궁합 결과 저장 실패:", error);
          return;
        }
        if (data) setMyMatchId(data.id);

        // 초대한 사람에게 "친구가 참여했어요" 알림 - 로그인된 상태에서만 의미가 있음
        // (respondent_user_id가 있어야 notify-chemistry-match가 본인 응답인지 확인 가능)
        if (user) {
          supabase.functions.invoke("notify-chemistry-match", { body: { chemistry_result_id: resultId } }).catch((err) => {
            console.error("궁합 알림 발송 실패:", err);
          });

          // 그룹 순위(단톡방 궁합) - 로그인 안 한 응답은 RLS상 남의 결과를 볼 수 없어서
          // 로그인한 경우에만 불러옴
          supabase
            .from("chemistry_matches")
            .select("id, respondent_nickname, percent, created_at")
            .eq("chemistry_result_id", resultId)
            .order("percent", { ascending: false })
            .then(({ data: board, error: boardErr }) => {
              if (boardErr) {
                console.error("그룹 순위 조회 실패:", boardErr);
                return;
              }
              setGroupBoard(board || []);
            });
        }
      });
  }, [detailUnlocked, resultId, user, profile, matched, total, percent]);

  const handleViewDetail = () => {
    if (user) {
      setDetailUnlocked(true);
      return;
    }
    // 비로그인 상태 - 카카오 로그인 보내기 전에 답변을 임시 저장해서
    // 로그인 후 돌아왔을 때 이어서 상세 결과를 바로 볼 수 있게 함.
    setDetailPending(true);
    try {
      sessionStorage.setItem(pendingKey, JSON.stringify({ answers: myAnswers }));
    } catch (err) {
      console.error("답변 임시 저장 실패:", err);
    }
    signInWithKakao();
  };

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

      const result = await shareChemistryInvite(
        supabase,
        () =>
          generateChemistryInviteCard({
            nickname: profile?.nickname || "친구",
            deckTitle: invite.deckTitle,
            questionCount: invite.questions.length,
          }),
        "chemistry-invite.png",
        {
          title: `${profile?.nickname || "친구"}님이 보낸 궁합 테스트`,
          description: text,
          linkUrl: url,
          buttonLabel: "궁합 테스트 시작",
        }
      );
      trackEvent("share", { method: result, content_type: "chemistry_next_invite" });
      setLinkState(result === "link-copied" ? "copied" : result === "cancelled" ? "idle" : result);
    } catch (err) {
      console.error("궁합 링크 생성 실패:", err);
      setLinkState("idle");
    }
    setTimeout(() => setLinkState("idle"), 3000);
  };

  // "이 링크 그대로" 그룹(단톡방)에 더 뿌려서 같은 순위판에 사람을 더 모으는 용도.
  // handleCreateNextLink와 다르게 새 초대를 만들지 않고 지금 이 resultId 링크를 그대로 씀.
  const handleShareGroup = async () => {
    setGroupShareState("creating");
    const url = `${window.location.origin}${window.location.pathname}`;
    const text = `우리 그룹 궁합 테스트 중! "${invite.deckTitle}" 풀고 나랑 몇 % 나오는지 확인해봐 👉 ${url}`;

    const result = await shareChemistryInvite(
      supabase,
      () =>
        generateChemistryInviteCard({
          nickname: invite.nickname,
          deckTitle: invite.deckTitle,
          questionCount: invite.questions.length,
        }),
      "chemistry-group-invite.png",
      {
        title: `${invite.nickname}님의 그룹 궁합 테스트`,
        description: text,
        linkUrl: url,
        buttonLabel: "궁합 테스트 시작",
      }
    );
    trackEvent("share", { method: result, content_type: "chemistry_group_invite" });
    setGroupShareState(result === "link-copied" ? "copied" : result === "cancelled" ? "idle" : result);
    setTimeout(() => setGroupShareState("idle"), 3000);
  };

  if (status === "loading") return <LoadingScreen label="궁합 테스트를 불러오는 중" />;

  if (status === "notfound") {
    return (
      <ChemistryLayout>
        <p className="empty-state">이 링크는 사용할 수 없어요. (만료됐거나 잘못된 링크예요)</p>
        <button className="deck-result__btn is-primary" onClick={() => navigate("/")}>
          홈으로
        </button>
      </ChemistryLayout>
    );
  }

  if (status === "intro") {
    const count = invite.questions.length;
    const minutes = Math.max(1, Math.round((count * 8) / 60));
    return (
      <ChemistryLayout>
        <div className="chemistry-intro">
          <div className="chemistry-intro__icon">💌</div>
          <h2>
            {invite.nickname}님이 당신에게
            <br />
            밸런스게임을 보냈어요
          </h2>
          <p>두 사람의 궁합을 확인해보세요.</p>
          <div className="chemistry-intro__meta">
            <span>📝 {count}문제</span>
            <span>⏱ 약 {minutes}분</span>
          </div>
          <button className="deck-result__btn is-primary" onClick={startPlaying}>
            궁합 테스트 시작
          </button>
        </div>
      </ChemistryLayout>
    );
  }

  if (status === "playing") {
    const current = queue[index];
    const isLast = index + 1 >= queue.length;
    return (
      <div className="page page--home">
        <PlayerStatusBar />
        <DeckProgress title={`${invite.nickname}님과 궁합`} current={index} total={queue.length} onExit={() => navigate("/")} />
        {current && (
          <BalanceCard
            key={current.id}
            q={current}
            onNext={handleNext}
            onVoted={handleVoted}
            nextLabel={isLast ? "궁합 결과 보기 👯" : "다음 문제 →"}
            recordVote={false}
          />
        )}
      </div>
    );
  }

  return (
    <ChemistryLayout>
      <ChemistryResult
        partnerName={invite.nickname}
        percent={percent}
        matched={matched}
        total={total}
        detailItems={detailItems}
        unlocked={detailUnlocked}
        detailPending={detailPending}
        onViewDetail={handleViewDetail}
        onCreateLink={handleCreateNextLink}
        onHome={() => navigate("/")}
        linkState={linkState}
        groupBoard={groupBoard}
        myMatchId={myMatchId}
        onShareGroup={handleShareGroup}
        groupShareState={groupShareState}
      />
    </ChemistryLayout>
  );
}
