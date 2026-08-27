import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { levelForXp, tierForLevel } from "../utils/levels";
import { useSession } from "../hooks/useSession";

function startOfWeek(d = new Date()) {
  const day = d.getDay(); // 0=일요일
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

const TABS = [
  { key: "weekly", label: "주간", periodFn: startOfWeek, title: "이번 주 챔피언" },
  { key: "monthly", label: "월간", periodFn: startOfMonth, title: "이번 달 챔피언" },
];

const MEDALS = ["🥇", "🥈", "🥉"];

export default function HallOfFame() {
  const { user } = useSession();
  const [tab, setTab] = useState("weekly");
  const [ranking, setRanking] = useState(null);
  const [myRank, setMyRank] = useState(null); // { rank, points, outsideTop } | null
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const load = async () => {
      const config = TABS.find((t) => t.key === tab);
      const periodStart = config.periodFn();

      try {
        const { data: events, error } = await supabase
          .from("xp_events")
          .select("user_id, amount")
          .gte("created_at", periodStart.toISOString())
          .limit(5000);
        if (error) throw error;

        const totals = {};
        (events || []).forEach(({ user_id, amount }) => {
          totals[user_id] = (totals[user_id] || 0) + (amount || 0);
        });

        const allRanked = Object.entries(totals).sort((a, b) => b[1] - a[1]);
        const top = allRanked.slice(0, 20);

        const profiles = await Promise.all(
          top.map(async ([userId, points]) => {
            const { data } = await supabase
              .from("profiles")
              .select("nickname, xp")
              .eq("id", userId)
              .maybeSingle();
            const level = levelForXp(data?.xp || 0);
            return {
              userId,
              points,
              nickname: data?.nickname || "(알 수 없음)",
              level,
              tier: tierForLevel(level),
            };
          })
        );

        if (cancelled) return;
        setRanking(profiles);

        if (user) {
          const idx = allRanked.findIndex(([userId]) => userId === user.id);
          if (idx === -1) {
            setMyRank(null);
          } else {
            setMyRank({ rank: idx + 1, points: allRanked[idx][1], outsideTop: idx >= 20 });
          }
        }
      } catch (err) {
        console.error("랭킹 로딩 실패:", err);
        if (!cancelled) setRanking([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [tab, user]);

  const config = TABS.find((t) => t.key === tab);

  return (
    <div className="page page--hall">
      <h2>명예의 전당</h2>

      <div className="hall-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`hall-tabs__item ${tab === t.key ? "is-active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="hall-loading">
          <div className="hall-loading__spinner" />
        </div>
      )}

      {!loading && ranking && ranking.length === 0 && (
        <p className="empty-state">아직 이 기간에 활동한 플레이어가 없어요.</p>
      )}

      {!loading && ranking && ranking.length > 0 && (
        <>
          {myRank && (
            <div className="hall-my-rank">
              <span className="hall-my-rank__label">내 순위</span>
              <span className="hall-my-rank__value">{myRank.rank}위</span>
              <span className="hall-my-rank__points">{myRank.points.toLocaleString()} XP</span>
            </div>
          )}
          {!myRank && user && <p className="hall-my-rank hall-my-rank--empty">아직 이 기간 순위에 없어요. 문제 풀고 랭킹에 도전해보세요!</p>}

          <div className="hall-list">
            {ranking.map((p, i) => (
              <div
                key={p.userId}
                className={`hall-list__item ${i < 3 ? `is-medal is-rank-${i + 1}` : ""} ${
                  p.userId === user?.id ? "is-me" : ""
                }`}
                style={{ animationDelay: `${Math.min(i, 10) * 0.03}s` }}
              >
                <div className="hall-list__rank">{i < 3 ? MEDALS[i] : i + 1}</div>
                <div className="hall-list__info">
                  <div className="hall-list__nickname">
                    {p.nickname}
                    {p.userId === user?.id && <span className="hall-list__me-badge">나</span>}
                    {i === 0 && <span className="hall-list__crown">{config.title}</span>}
                  </div>
                  <div className="hall-list__meta">
                    <span className="hall-list__tier" style={{ background: p.tier.color }}>
                      {p.tier.label}
                    </span>
                    <span>Lv.{p.level}</span>
                  </div>
                </div>
                <div className="hall-list__points">{p.points.toLocaleString()} XP</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
