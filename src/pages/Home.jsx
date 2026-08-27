import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import { CATEGORIES, categoryMeta } from "../data/categories";
import CategoryGrid from "../components/CategoryGrid";
import DeckRow from "../components/DeckRow";
import DeckCard from "../components/DeckCard";
import DeckProgress from "../components/DeckProgress";
import DeckResult from "../components/DeckResult";
import BalanceCard from "../components/BalanceCard";
import PlayerStatusBar from "../components/PlayerStatusBar";
import EnergyEmpty from "../components/EnergyEmpty";
import AdFitBanner from "../components/AdFitBanner";
import LoadingScreen from "../components/LoadingScreen";
import { useSession } from "../hooks/useSession";

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// question_sets 테이블이 아직 없는 프로젝트(마이그레이션 전)에서도 예전처럼
// 카테고리당 문제 하나의 "가상 문제집"으로 동작하도록 하는 폴백.
function buildFallbackDecks(questions) {
  return CATEGORIES.map((category) => {
    const qs = questions.filter((q) => q.category === category);
    const totalVotes = qs.reduce((sum, q) => sum + (q.votes_a || 0) + (q.votes_b || 0), 0);
    return {
      id: `fallback-${category}`,
      category,
      title: `${category} 모음집`,
      emoji: categoryMeta(category).emoji,
      description: null,
      created_at: null,
      questions: qs,
      questionCount: qs.length,
      totalVotes,
    };
  }).filter((d) => d.questionCount > 0);
}

export default function Home() {
  const { player } = useSession();
  const [questions, setQuestions] = useState([]);
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState("browse"); // browse | category | playing | result
  const [category, setCategory] = useState(null);
  const [activeDeck, setActiveDeck] = useState(null);
  const [queue, setQueue] = useState([]);
  const [deckIndex, setDeckIndex] = useState(0);
  const [sessionAnswers, setSessionAnswers] = useState([]);
  const [xpEarned, setXpEarned] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: qData, error: qErr } = await supabase
        .from("questions")
        .select("*")
        .eq("status", "approved");
      if (qErr) console.error("문제 목록 로딩 실패:", qErr);
      const qs = qData || [];

      const { data: setData, error: setErr } = await supabase
        .from("question_sets")
        .select("*, creator:profiles(nickname)");

      if (cancelled) return;

      let builtDecks;
      if (setErr || !setData) {
        // question_sets 테이블이 없는(마이그레이션 전) 프로젝트를 위한 폴백
        builtDecks = buildFallbackDecks(qs);
      } else {
        builtDecks = setData
          .map((set) => {
            const setQuestions = qs.filter((q) => q.set_id === set.id);
            const totalVotes = setQuestions.reduce(
              (sum, q) => sum + (q.votes_a || 0) + (q.votes_b || 0),
              0
            );
            return {
              ...set,
              questions: setQuestions,
              questionCount: setQuestions.length,
              totalVotes,
              creatorName: set.creator?.nickname || "운영자",
            };
          })
          .filter((d) => d.questionCount > 0);

        // set_id가 없는(마이그레이션 직후 아직 안 묶인) 문제들도 카테고리별 임시 문제집으로 노출
        const unassigned = qs.filter((q) => !q.set_id);
        if (unassigned.length > 0) {
          builtDecks = builtDecks.concat(buildFallbackDecks(unassigned));
        }
      }

      setQuestions(qs);
      setDecks(builtDecks);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useMemo(() => {
    const map = {};
    questions.forEach((q) => {
      map[q.category] = (map[q.category] || 0) + 1;
    });
    return map;
  }, [questions]);

  // 플레이어 레벨 기준으로 잠금 여부를 계산해서 덧붙임 (min_level이 없는 폴백 문제집은 항상 잠금 해제)
  const unlockedDecks = useMemo(() => {
    const myLevel = player?.level || 1;
    return decks.map((d) => ({ ...d, locked: (d.min_level || 1) > myLevel }));
  }, [decks, player]);

  const newDecks = useMemo(
    () =>
      [...unlockedDecks]
        .filter((d) => d.created_at)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 6)
        .map((d) => ({ ...d, badge: "new", badgeLabel: "NEW" })),
    [unlockedDecks]
  );

  const bestDecks = useMemo(
    () =>
      [...unlockedDecks]
        .sort((a, b) => b.totalVotes - a.totalVotes)
        .slice(0, 6)
        .map((d) => ({ ...d, badge: "best", badgeLabel: "BEST" })),
    [unlockedDecks]
  );

  const categoryDecks = useMemo(
    () => unlockedDecks.filter((d) => d.category === category),
    [unlockedDecks, category]
  );

  const startDeck = (deck) => {
    if (deck.locked) return; // DeckCard가 자체적으로 클릭을 막지만 방어적으로 한 번 더 체크
    setActiveDeck(deck);
    setQueue(shuffle(deck.questions));
    setDeckIndex(0);
    setSessionAnswers([]);
    setXpEarned(0);
    setView("playing");
  };

  const handleVoted = (side, votesA, votesB) => {
    setSessionAnswers((prev) => [...prev, { side, votesA, votesB }]);
    setXpEarned((prev) => prev + 1);
  };

  const handleNext = () => {
    if (deckIndex + 1 >= queue.length) {
      setView("result");
    } else {
      setDeckIndex((i) => i + 1);
    }
  };

  const goBrowse = () => {
    setView("browse");
    setCategory(null);
    setActiveDeck(null);
  };

  const goCategory = (c) => {
    setCategory(c);
    setView("category");
  };

  if (loading) {
    return <LoadingScreen label="문제집을 불러오는 중" />;
  }

  const energyEmpty = player && player.currentEnergy <= 0;

  if (view === "playing" && activeDeck) {
    const current = queue[deckIndex];
    const isLast = deckIndex + 1 >= queue.length;
    return (
      <div className="page page--home">
        <PlayerStatusBar />
        <DeckProgress
          title={activeDeck.title}
          current={deckIndex}
          total={queue.length}
          onExit={goBrowse}
        />
        {energyEmpty && <EnergyEmpty />}
        {!energyEmpty && current && (
          <BalanceCard
            key={current.id}
            q={current}
            onNext={handleNext}
            onVoted={handleVoted}
            nextLabel={isLast ? "결과 보기 🎉" : "다음 문제 →"}
          />
        )}
      </div>
    );
  }

  if (view === "result" && activeDeck) {
    return (
      <div className="page page--home">
        <DeckResult
          deckTitle={activeDeck.title}
          answers={sessionAnswers}
          xpEarned={xpEarned}
          onRestart={() => startDeck(activeDeck)}
          onOtherDecks={() => goCategory(activeDeck.category)}
          onHome={goBrowse}
        />
      </div>
    );
  }

  if (view === "category") {
    return (
      <div className="page page--home">
        <button className="back-link" onClick={goBrowse}>
          ← 카테고리 다시 선택
        </button>
        <PlayerStatusBar />
        <h2 className="category-grid__title">
          {categoryMeta(category).emoji} {category}
        </h2>
        {categoryDecks.length === 0 && (
          <p className="empty-state">
            아직 이 카테고리에 등록된 문제집이 없어요. 직접 등록해보시겠어요?
          </p>
        )}
        <div className="deck-list">
          {categoryDecks.map((deck) => (
            <DeckCard key={deck.id} deck={deck} onSelect={startDeck} size="md" />
          ))}
        </div>
      </div>
    );
  }

  // browse (기본 홈 화면)
  return (
    <div className="page page--home">
      <PlayerStatusBar />
      <DeckRow title="🔥 신규 문제집" decks={newDecks} onSelect={startDeck} />
      <DeckRow title="🏆 베스트 문제집" decks={bestDecks} onSelect={startDeck} />
      <CategoryGrid categories={CATEGORIES} counts={counts} onSelect={goCategory} />
      {!player?.isPremium && (
        <div className="home-ad">
          <AdFitBanner adUnit="DAN-XXXXXXXXXXXXXXXX" width={320} height={100} />
        </div>
      )}
    </div>
  );
}
