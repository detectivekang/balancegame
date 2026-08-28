import React from "react";
import { worldcupCategoryMeta } from "../data/worldcupCategories";

export default function WorldCupCard({ worldcup, onSelect, size = "grid" }) {
  const meta = worldcupCategoryMeta(worldcup.category);
  const authorName = worldcup.creatorName || "운영자";

  return (
    <button
      className={`wc-card wc-card--${size}`}
      style={worldcup.coverImage ? { backgroundImage: `url(${worldcup.coverImage})` } : undefined}
      onClick={() => onSelect(worldcup)}
    >
      {!worldcup.coverImage && <span className={`wc-card__fallback ${meta.className}`}>{meta.emoji}</span>}
      <span className="wc-card__scrim" />

      {worldcup.badge && <span className={`deck-card__badge is-${worldcup.badge}`}>{worldcup.badgeLabel}</span>}

      <div className="wc-card__body">
        <span className="wc-card__category">
          {meta.emoji} {worldcup.category}
        </span>
        <span className="wc-card__title">{worldcup.title}</span>
        <span className="wc-card__meta">{worldcup.itemCount}명의 후보</span>
      </div>

      <div className="wc-card__footer">
        {worldcup.creatorAvatar ? (
          <img className="wc-card__author-avatar" src={worldcup.creatorAvatar} alt="" />
        ) : (
          <span className="wc-card__author-avatar">👤</span>
        )}
        <span className="wc-card__author-name">{authorName}</span>
      </div>
    </button>
  );
}
