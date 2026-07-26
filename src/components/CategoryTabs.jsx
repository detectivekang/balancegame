import React from "react";
import { CATEGORIES } from "../data/categories";

export default function CategoryTabs({ selected, onSelect }) {
  return (
    <div className="category-tabs">
      <button
        className={`category-tabs__item ${selected === null ? "is-active" : ""}`}
        onClick={() => onSelect(null)}
      >
        전체
      </button>
      {CATEGORIES.map((c) => (
        <button
          key={c}
          className={`category-tabs__item ${selected === c ? "is-active" : ""}`}
          onClick={() => onSelect(c)}
        >
          {c}
        </button>
      ))}
    </div>
  );
}
