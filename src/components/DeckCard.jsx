import React from "react";
import { categoryMeta } from "../data/categories";

export default function DeckCard({ deck, onSelect, size = "md" }) {
  const meta = categoryMeta(deck.category);
  const hasCover = Boolean(deck.cover_image_url);
  const authorName = deck.creatorName || "운영자";

  return (
    <button
      className={`deck-card deck-card--${size} ${!hasCover ? meta.className : ""} ${
        hasCover ? "has-cover" : ""
      } ${deck.locked ? "is-locked" : ""}`}
      style={hasCover ? { backgroundImage: `url(${deck.cover_image_url})` } : undefined}
      onClick={() => !deck.locked && onSelect(deck)}
    >
      {hasCover && <span className="deck-card__scrim" />}

      {deck.locked ? (
        <span className="deck-card__badge is-locked">🔒 Lv.{deck.min_level}</span>
      ) : (
        deck.badge && <span className={`deck-card__badge is-${deck.badge}`}>{deck.badgeLabel}</span>
      )}

      <div className="deck-card__body">
        {!hasCover && <span className="deck-card__emoji">{deck.emoji || meta.emoji}</span>}
        <span className="deck-card__title">{deck.title}</span>
        <span className="deck-card__meta">
          {deck.locked
            ? `Lv.${deck.min_level}에 잠금 해제`
            : `${deck.questionCount}개 문제 · 참여 ${deck.totalVotes.toLocaleString()}`}
        </span>
      </div>

      <div className="deck-card__footer">
        {deck.creatorAvatar ? (
          <img className="deck-card__author-avatar" src={deck.creatorAvatar} alt="" />
        ) : (
          <span className="deck-card__author-avatar">👤</span>
        )}
        <span className="deck-card__author-name">{authorName}</span>
      </div>
    </button>
  );
}
