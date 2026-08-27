import React, { useMemo } from "react";

const MEDALS = ["🥇", "🥈", "🥉"];

export default function WorldCupStats({ worldcup, onBack }) {
  const ranked = useMemo(() => {
    return [...worldcup.items]
      .map((it) => ({
        ...it,
        winRate: it.match_count > 0 ? Math.round((it.win_count / it.match_count) * 100) : null,
      }))
      .sort((a, b) => {
        if (b.champion_count !== a.champion_count) return b.champion_count - a.champion_count;
        return (b.winRate || 0) - (a.winRate || 0);
      });
  }, [worldcup.items]);

  const totalMatches = worldcup.items.reduce((sum, it) => sum + it.match_count, 0) / 2;

  return (
    <div className="page page--home">
      <button className="back-link" onClick={onBack}>
        ← 뒤로
      </button>
      <h2 className="category-grid__title">📊 {worldcup.title} 통계</h2>
      <p className="page__desc">지금까지 {Math.round(totalMatches).toLocaleString()}번의 대결이 있었어요</p>

      <div className="hall-list">
        {ranked.map((item, i) => (
          <div
            key={item.id}
            className={`wc-stats__item ${i < 3 ? `is-medal is-rank-${i + 1}` : ""}`}
            style={{ animationDelay: `${Math.min(i, 10) * 0.03}s` }}
          >
            <div className="hall-list__rank">{i < 3 ? MEDALS[i] : i + 1}</div>
            <img className="wc-stats__thumb" src={item.image_url} alt={item.label} />
            <div className="hall-list__info">
              <div className="hall-list__nickname">{item.label}</div>
              <div className="hall-list__meta">
                <span>🏆 우승 {item.champion_count}회</span>
                <span>· 대결 {item.match_count}번</span>
              </div>
            </div>
            <div className="wc-stats__winrate">{item.winRate === null ? "-" : `${item.winRate}%`}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
