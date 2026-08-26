import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { levelForXp, tierForLevel } from "../utils/levels";

const PAGE_SIZE = 20;

export default function AdminPlayers() {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [togglingId, setTogglingId] = useState(null);

  const loadPage = async (pageIndex) => {
    const from = pageIndex * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      console.error(error);
      return;
    }

    const withCounts = await Promise.all(
      (data || []).map(async (p) => {
        const { count: voteCount } = await supabase
          .from("votes")
          .select("*", { count: "exact", head: true })
          .eq("user_id", p.id);
        const xp = p.xp || 0;
        const level = levelForXp(xp);
        return {
          id: p.id,
          nickname: p.nickname || "(닉네임 없음)",
          age: p.age,
          gender: p.gender,
          firstSeenDate: p.first_seen_date,
          voteCount: voteCount || 0,
          xp,
          level,
          tier: tierForLevel(level),
          isPremium: Boolean(p.is_premium),
        };
      })
    );

    setPlayers((prev) => (pageIndex === 0 ? withCounts : [...prev, ...withCounts]));
    setHasMore((data || []).length === PAGE_SIZE);
  };

  useEffect(() => {
    loadPage(0).finally(() => setLoading(false));
  }, []);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    const nextPage = page + 1;
    await loadPage(nextPage);
    setPage(nextPage);
    setLoadingMore(false);
  };

  // ⚠️ 실제 결제(토스페이먼츠/카카오페이/앱스토어 IAP 등) 연동 전까지 임시로
  // 관리자가 수동으로 무제한 이용권을 켜고 끄는 버튼입니다.
  // 실 서비스에서는 결제 완료 웹훅에서 is_premium/premium_until을 채우는 방식으로 대체하면 됩니다.
  const togglePremium = async (player) => {
    setTogglingId(player.id);
    const next = !player.isPremium;
    const { error } = await supabase
      .from("profiles")
      .update({ is_premium: next, premium_until: null })
      .eq("id", player.id);
    setTogglingId(null);
    if (error) {
      console.error(error);
      return;
    }
    setPlayers((prev) => prev.map((p) => (p.id === player.id ? { ...p, isPremium: next } : p)));
  };

  if (loading) return <p>불러오는 중...</p>;
  if (players.length === 0) return <p>아직 가입한 플레이어가 없습니다.</p>;

  return (
    <div className="admin-players">
      <div className="admin-players__table-wrap">
        <table className="admin-players__table">
          <thead>
            <tr>
              <th>닉네임</th>
              <th>나이</th>
              <th>성별</th>
              <th>레벨/티어</th>
              <th>XP</th>
              <th>가입일</th>
              <th>참여 문제 수</th>
              <th>무제한 이용권</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.id}>
                <td>{p.nickname}</td>
                <td>{p.age}</td>
                <td>{p.gender}</td>
                <td>
                  Lv.{p.level} · {p.tier.label}
                </td>
                <td>{p.xp.toLocaleString()}</td>
                <td>{p.firstSeenDate}</td>
                <td>{p.voteCount.toLocaleString()}</td>
                <td>
                  <button
                    className={`admin-players__premium-btn ${p.isPremium ? "is-on" : ""}`}
                    onClick={() => togglePremium(p)}
                    disabled={togglingId === p.id}
                  >
                    {p.isPremium ? "✅ 이용중" : "부여하기"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <button className="admin-players__more" onClick={handleLoadMore} disabled={loadingMore}>
          {loadingMore ? "불러오는 중..." : "더 보기"}
        </button>
      )}
    </div>
  );
}
