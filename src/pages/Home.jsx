import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import { CATEGORIES } from "../data/categories";
import CategoryGrid from "../components/CategoryGrid";
import BalanceCard from "../components/BalanceCard";
import PlayerStatusBar from "../components/PlayerStatusBar";
import EnergyEmpty from "../components/EnergyEmpty";
import { useSession } from "../hooks/useSession";

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function Home() {
  const { player } = useSession();
  const [questions, setQuestions] = useState([]);
  const [category, setCategory] = useState(null); // null = 카테고리 선택 화면
  const [queue, setQueue] = useState([]); // 랜덤 순서로 섞인 현재 카테고리의 문제 큐
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("questions")
      .select("*")
      .eq("status", "approved")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error("문제 목록 로딩 실패:", error);
        setQuestions(data || []);
        setLoading(false);
      });
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

  const current = queue[0] || null;

  const handleSelectCategory = (c) => {
    const pool = questions.filter((q) => q.category === c);
    setCategory(c);
    setQueue(shuffle(pool));
  };

  const handleNext = () => {
    setQueue((prev) => {
      const rest = prev.slice(1);
      if (rest.length > 0) return rest;
      // 다 풀었으면 같은 카테고리 문제를 다시 랜덤 순서로 셔플해서 계속 진행
      const pool = questions.filter((q) => q.category === category);
      return shuffle(pool);
    });
  };

  if (loading) {
    return <p className="empty-state">문제를 불러오는 중...</p>;
  }

  if (!category) {
    return (
      <div className="page page--home">
        <PlayerStatusBar />
        <CategoryGrid categories={CATEGORIES} counts={counts} onSelect={handleSelectCategory} />
      </div>
    );
  }

  const energyEmpty = player && player.currentEnergy <= 0;

  return (
    <div className="page page--home">
      <button className="back-link" onClick={() => setCategory(null)}>
        ← 카테고리 다시 선택
      </button>

      <PlayerStatusBar />

      {energyEmpty && <EnergyEmpty />}

      {!energyEmpty && !current && (
        <p className="empty-state">
          아직 이 카테고리에 등록된 문제가 없어요. 직접 등록해보시겠어요?
        </p>
      )}

      {!energyEmpty && current && (
        <BalanceCard key={current.id} q={current} onNext={handleNext} />
      )}
    </div>
  );
}
