import React from "react";
import WorldCupCard from "./WorldCupCard";

export default function WorldCupRow({ title, worldcups, onSelect }) {
  if (!worldcups || worldcups.length === 0) return null;

  return (
    <div className="deck-row">
      <h3 className="deck-row__title">{title}</h3>
      <div className="deck-row__scroll">
        {worldcups.map((wc) => (
          <WorldCupCard key={wc.id} worldcup={wc} onSelect={onSelect} size="sm" />
        ))}
      </div>
    </div>
  );
}
