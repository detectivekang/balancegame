import React from "react";

const CATEGORY_META = {
  "연애/심리": { emoji: "💕", className: "is-love" },
  "일상/개취": { emoji: "🍗", className: "is-daily" },
  "커리어/현실": { emoji: "💼", className: "is-career" },
  "상상/극단적 선택": { emoji: "🚀", className: "is-imagine" },
};

export default function CategoryGrid({ categories, counts, onSelect }) {
  return (
    <div className="category-grid">
      <h2 className="category-grid__title">어떤 밸런스게임 할까요?</h2>
      <div className="category-grid__list">
        {categories.map((c) => {
          const meta = CATEGORY_META[c] || { emoji: "⚖️", className: "" };
          return (
            <button
              key={c}
              className={`category-grid__card ${meta.className}`}
              onClick={() => onSelect(c)}
            >
              <span className="category-grid__emoji">{meta.emoji}</span>
              <span className="category-grid__name">{c}</span>
              <span className="category-grid__count">{counts[c] || 0}개 문제</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
