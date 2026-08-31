import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { Link, useSearchParams } from "react-router-dom";
import { WORLDCUP_CATEGORIES, ROUND_SIZES, worldcupCategoryMeta } from "../data/worldcupCategories";
import WorldCupCard from "../components/WorldCupCard";
import WorldCupMatch from "../components/WorldCupMatch";
import WorldCupResult from "../components/WorldCupResult";
import WorldCupStats from "../components/WorldCupStats";
import WorldCupRow from "../components/WorldCupRow";
import LoadingScreen from "../components/LoadingScreen";
import PlayerStatusBar from "../components/PlayerStatusBar";
import EnergyEmpty from "../components/EnergyEmpty";
import ReportButton from "../components/ReportButton";
import { useSession } from "../hooks/useSession";

// 매치마다가 아니라 월드컵 하나를 "입장"할 때 한 번만 소모되는 에너지.
// 한 번 내면 4강이든 256강이든 끝까지 자유롭게 플레이 가능.
// Lv.1 에너지 최대치(5)에 맞춰서, 갓 시작한 유저도 풀충전이면 한 번은 바로 해볼 수 있게 5로 설정.
const WORLDCUP_ENTRY_COST = 5;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function chunkPairs(arr) {
  const pairs = [];
  for (let i = 0; i < arr.length; i += 2) pairs.push([arr[i], arr[i + 1]]);
  return pairs;
}

function roundLabelFor(itemCount, isFinal) {
  if (isFinal) return "결승";
  if (itemCount === 4) return "4강";
  return `${itemCount}강`;
}

export default function WorldCup() {
  const { player, profile, startWorldcupSession } = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const [worldcups, setWorldcups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState(null);

  const [view, setView] = useState("browse"); // browse | roundSelect | playing | result | stats
  const [selected, setSelected] = useState(null);
  const [roundSize, setRoundSize] = useState(null);
  const [entering, setEntering] = useState(false);
  const [entryError, setEntryError] = useState(null); // 'energy' | 'other' | null

  const [matches, setMatches] = useState([]);
  const [matchIndex, setMatchIndex] = useState(0);
  const [winners, setWinners] = useState([]);
  const [roundItemCount, setRoundItemCount] = useState(0);
  const [champion, setChampion] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: wcs, error: wcErr } = await supabase
        .from("worldcups")
        .select("*, creator:profiles(nickname, avatar_url)")
        .eq("status", "approved");
      if (wcErr) console.error("월드컵 목록 로딩 실패:", wcErr);

      const { data: items, error: itemErr } = await supabase
        .from("worldcup_items")
        .select("id, worldcup_id, image_url, label, win_count, match_count, champion_count");
      if (itemErr) console.error("월드컵 후보 로딩 실패:", itemErr);

      if (cancelled) return;

      const itemsByWc = {};
      (items || []).forEach((it) => {
        (itemsByWc[it.worldcup_id] = itemsByWc[it.worldcup_id] || []).push(it);
      });

      const built = (wcs || [])
        .map((w) => {
          const wcItems = itemsByWc[w.id] || [];
          return {
            ...w,
            creatorName: w.creator?.nickname || "운영자",
            creatorAvatar: w.creator?.avatar_url || null,
            items: wcItems,
            itemCount: wcItems.length,
            coverImage: wcItems[0]?.image_url || null,
          };
        })
        .filter((w) => w.itemCount >= 4); // 최소 4강은 돼야 플레이 가능

      setWorldcups(built);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // "나도 도전하기" 링크(?play=worldcupId)로 들어온 경우, 그 월드컵을 자동으로 선택해서
  // 목록에서 다시 찾아 누를 필요 없이 바로 강수 선택 화면으로 이동시킴.
  // (최초 로딩 effect 안에 있으면, 페이지가 리마운트 없이 떠 있는 채로 ?play= 값만
  // 바뀌었을 때 감지를 못 해서 "처음 한 번만 되고 그다음부터 안 먹히는" 버그가 생김)
  useEffect(() => {
    if (worldcups.length === 0) return;
    const playId = searchParams.get("play");
    if (!playId) return;
    const target = worldcups.find((w) => w.id === playId);
    if (target) {
      setSelected(target);
      setEntryError(null);
      setView("roundSelect");
    }
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldcups, searchParams]);

  const filteredWorldcups = useMemo(
    () => (categoryFilter ? worldcups.filter((w) => w.category === categoryFilter) : worldcups),
    [worldcups, categoryFilter]
  );

  const newWorldcups = useMemo(
    () =>
      [...worldcups]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 6)
        .map((w) => ({ ...w, badge: "new", badgeLabel: "NEW" })),
    [worldcups]
  );

  const bestWorldcups = useMemo(
    () =>
      [...worldcups]
        .map((w) => ({ ...w, totalMatches: w.items.reduce((sum, it) => sum + it.match_count, 0) }))
        .sort((a, b) => b.totalMatches - a.totalMatches)
        .slice(0, 6)
        .map((w) => ({ ...w, badge: "best", badgeLabel: "BEST" })),
    [worldcups]
  );

  const validRounds = useMemo(() => {
    if (!selected) return [];
    return ROUND_SIZES.filter((r) => r <= selected.itemCount);
  }, [selected]);

  const selectWorldcup = (wc) => {
    setSelected(wc);
    setEntryError(null);
    setView("roundSelect");
  };

  const startTournament = async (size) => {
    if (entering) return;
    setEntering(true);
    setEntryError(null);

    if (!player?.isPremium) {
      try {
        await startWorldcupSession(WORLDCUP_ENTRY_COST);
      } catch (err) {
        console.error("월드컵 입장 실패:", err);
        const raw = err?.message || "";
        setEntryError(raw.includes("not enough energy") ? "energy" : "other");
        setEntering(false);
        return;
      }
    }

    const pool = shuffle(selected.items).slice(0, size);
    setRoundSize(size);
    setMatches(chunkPairs(pool));
    setMatchIndex(0);
    setWinners([]);
    setRoundItemCount(size);
    setChampion(null);
    setEntering(false);
    setView("playing");
  };

  const handlePick = async (winner, loser) => {
    try {
      await supabase.rpc("record_worldcup_match", { p_winner_id: winner.id, p_loser_id: loser.id });
    } catch (err) {
      console.error("매치 결과 기록 실패:", err);
    }

    // 방금 플레이한 세션 안에서 통계 화면을 봐도 바로 반영되도록 로컬 상태도 갱신
    setSelected((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((it) => {
          if (it.id === winner.id) return { ...it, win_count: it.win_count + 1, match_count: it.match_count + 1 };
          if (it.id === loser.id) return { ...it, match_count: it.match_count + 1 };
          return it;
        }),
      };
    });

    const nextWinners = [...winners, winner];

    if (matchIndex + 1 < matches.length) {
      setWinners(nextWinners);
      setMatchIndex((i) => i + 1);
      return;
    }

    // 이번 라운드 끝
    if (nextWinners.length === 1) {
      setChampion(nextWinners[0]);
      try {
        await supabase.rpc("record_worldcup_champion", { p_item_id: nextWinners[0].id });
      } catch (err) {
        console.error("우승 기록 실패:", err);
      }
      setSelected((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((it) =>
            it.id === nextWinners[0].id ? { ...it, champion_count: it.champion_count + 1 } : it
          ),
        };
      });
      setView("result");
      return;
    }

    setMatches(chunkPairs(nextWinners));
    setMatchIndex(0);
    setWinners([]);
    setRoundItemCount(nextWinners.length);
  };

  const goBrowse = () => {
    setView("browse");
    setSelected(null);
    setRoundSize(null);
  };

  if (loading) return <LoadingScreen label="월드컵을 불러오는 중" />;

  if (view === "playing" && matches.length > 0) {
    const [left, right] = matches[matchIndex];
    const isFinal = roundItemCount === 2;
    return (
      <div className="page page--home">
        <button className="back-link" onClick={goBrowse}>
          ✕ 나가기
        </button>
        <WorldCupMatch
          key={`${roundItemCount}-${matchIndex}`}
          roundLabel={roundLabelFor(roundItemCount, isFinal)}
          matchLabel={`${matchIndex + 1} / ${matches.length}`}
          left={left}
          right={right}
          onPick={handlePick}
        />
      </div>
    );
  }

  if (view === "result" && champion && selected) {
    return (
      <div className="page page--home">
        <WorldCupResult
          worldcupId={selected.id}
          worldcupTitle={selected.title}
          champion={champion}
          roundSize={roundSize}
          onRestart={() => startTournament(roundSize)}
          onOtherWorldcups={goBrowse}
          onHome={goBrowse}
        />
        <button className="wc-stats-link" onClick={() => setView("stats")}>
          📊 이 월드컵 통계 보기
        </button>
      </div>
    );
  }

  if (view === "stats" && selected) {
    return <WorldCupStats worldcup={selected} onBack={() => setView("roundSelect")} />;
  }

  if (view === "roundSelect" && selected) {
    return (
      <div className="page page--home">
        <button className="back-link" onClick={goBrowse}>
          ← 월드컵 다시 선택
        </button>
        <PlayerStatusBar />
        <h2 className="category-grid__title">{selected.title}</h2>
        <p className="page__desc">
          몇 강으로 즐기실래요? (후보 {selected.itemCount}명)
          {!player?.isPremium && ` · 입장에 ⚡${WORLDCUP_ENTRY_COST} 소모, 한 번 내면 끝까지 무료!`}
          {player?.isPremium && " · 👑 무제한 이용권이라 무료로 입장해요!"}
        </p>

        {entryError === "energy" && <EnergyEmpty />}
        {entryError === "other" && (
          <p className="balance-card__error">⚠️ 입장 처리 중 오류가 발생했어요. 다시 시도해주세요.</p>
        )}

        {entryError !== "energy" && (
          <div className="wc-round-picker">
            {validRounds.map((r) => (
              <button
                key={r}
                className="wc-round-picker__btn"
                onClick={() => startTournament(r)}
                disabled={entering}
              >
                {r}강
              </button>
            ))}
          </div>
        )}

        <button className="wc-stats-link" onClick={() => setView("stats")}>
          📊 역대 우승 통계 보기
        </button>
        <ReportButton
          className="wc-report-link"
          label="🚩 이 월드컵 신고하기"
          target={{ type: "worldcup", id: selected.id, label: selected.title }}
        />
      </div>
    );
  }

  // browse
  return (
    <div className="page page--home">
      <PlayerStatusBar />

      <WorldCupRow title="🔥 신규 월드컵" worldcups={newWorldcups} onSelect={selectWorldcup} />
      <WorldCupRow title="🏆 베스트 월드컵" worldcups={bestWorldcups} onSelect={selectWorldcup} />

      <div className="wc-category-filter">
        <button
          className={`wc-category-filter__chip ${!categoryFilter ? "is-active" : ""}`}
          onClick={() => setCategoryFilter(null)}
        >
          전체
        </button>
        {WORLDCUP_CATEGORIES.map((c) => {
          const meta = worldcupCategoryMeta(c);
          return (
            <button
              key={c}
              className={`wc-category-filter__chip ${categoryFilter === c ? "is-active" : ""}`}
              onClick={() => setCategoryFilter(c)}
            >
              {meta.emoji} {c}
            </button>
          );
        })}
      </div>

      {filteredWorldcups.length === 0 && (
        <p className="empty-state">아직 등록된 월드컵이 없어요. 직접 만들어보세요!</p>
      )}

      <div className="wc-grid">
        {filteredWorldcups.map((wc) => (
          <WorldCupCard key={wc.id} worldcup={wc} onSelect={selectWorldcup} />
        ))}
      </div>

      <Link to="/worldcup/submit" className="wc-create-fab">
        ➕ 월드컵 만들기
      </Link>
    </div>
  );
}
