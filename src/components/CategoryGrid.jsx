import React from "react";
import { categoryMeta } from "../data/categories";

export default function CategoryGrid({ categories, counts, onSelect }) {
  return (
    <div className="category-grid">
      <h2 className="category-grid__title">어떤 밸런스게임 할까요?</h2>
      <div className="category-grid__list">
        {categories.map((c) => {
          const meta = categoryMeta(c);
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
