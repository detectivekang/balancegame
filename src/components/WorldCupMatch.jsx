import React, { useState } from "react";
import ReportButton from "./ReportButton";

export default function WorldCupMatch({ roundLabel, matchLabel, left, right, onPick }) {
  const [picking, setPicking] = useState(false);

  const pick = (winner, loser) => {
    if (picking) return;
    setPicking(true);
    onPick(winner, loser);
  };

  return (
    <div className="wc-match">
      <div className="wc-match__header">
        <span className="wc-match__round">{roundLabel}</span>
        <span className="wc-match__count">{matchLabel}</span>
      </div>

      <div className="wc-match__pair">
        <div className="wc-match__item-wrap">
          <button className="wc-match__item" onClick={() => pick(left, right)} disabled={picking}>
            <img src={left.image_url} alt={left.label} />
            <span className="wc-match__label">{left.label}</span>
          </button>
          <ReportButton
            className="wc-match__report"
            label="🚩"
            target={{ type: "worldcup_item", id: left.id, label: left.label, imageUrl: left.image_url }}
          />
        </div>

        <div className="wc-match__vs">VS</div>

        <div className="wc-match__item-wrap">
          <button className="wc-match__item" onClick={() => pick(right, left)} disabled={picking}>
            <img src={right.image_url} alt={right.label} />
            <span className="wc-match__label">{right.label}</span>
          </button>
          <ReportButton
            className="wc-match__report"
            label="🚩"
            target={{ type: "worldcup_item", id: right.id, label: right.label, imageUrl: right.image_url }}
          />
        </div>
      </div>
    </div>
  );
}
