import React, { useEffect, useState } from "react";
import ReportButton from "./ReportButton";

export default function WorldCupMatch({ roundLabel, matchLabel, left, right, onPick }) {
  const [picking, setPicking] = useState(false);

  // left/right가 바뀌면(=다음 매치로 넘어가면) 이전 매치에서 눌러놨던
  // picking 상태를 반드시 초기화함. 이게 없으면 첫 매치에서 한 번 고른 뒤
  // 버튼이 disabled 상태로 계속 남아서, 두 번째 매치부터 아무것도 눌리지
  // 않는 것처럼 보이는 버그가 생김.
  useEffect(() => {
    setPicking(false);
  }, [left?.id, right?.id]);

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
