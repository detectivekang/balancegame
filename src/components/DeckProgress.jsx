import React from "react";
import ReportButton from "./ReportButton";

export default function DeckProgress({ title, current, total, onExit, deckId }) {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="deck-progress">
      <div className="deck-progress__top">
        <button className="deck-progress__exit" onClick={onExit}>
          ✕
        </button>
        <span className="deck-progress__title">{title}</span>
        <span className="deck-progress__count">
          {Math.min(current + 1, total)}/{total}
        </span>
        {deckId && (
          <ReportButton
            className="deck-progress__report"
            label="🚩"
            target={{ type: "question_set", id: deckId, label: title }}
          />
        )}
      </div>
      <div className="deck-progress__track">
        <div className="deck-progress__fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
