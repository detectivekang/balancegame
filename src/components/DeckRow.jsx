import React from "react";
import DeckCard from "./DeckCard";

export default function DeckRow({ title, decks, onSelect }) {
  if (!decks || decks.length === 0) return null;

  return (
    <div className="deck-row">
      <h3 className="deck-row__title">{title}</h3>
      <div className="deck-row__scroll">
        {decks.map((deck) => (
          <DeckCard key={deck.id} deck={deck} onSelect={onSelect} size="sm" />
        ))}
      </div>
    </div>
  );
}
