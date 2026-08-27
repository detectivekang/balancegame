import React from "react";
import { NavLink } from "react-router-dom";

export default function ModeTabs() {
  return (
    <nav className="mode-tabs">
      <NavLink to="/" end className={({ isActive }) => `mode-tabs__item ${isActive ? "is-active" : ""}`}>
        ⚖️ 밸런스게임
      </NavLink>
      <NavLink
        to="/worldcup"
        className={({ isActive }) => `mode-tabs__item ${isActive ? "is-active" : ""}`}
      >
        🏆 이상형 월드컵
      </NavLink>
    </nav>
  );
}
