import React from "react";
import { Link } from "react-router-dom";
import { useSession } from "../hooks/useSession";

export default function Header() {
  const { profile, isAdmin } = useSession();

  return (
    <header className="app-header">
      <Link to="/" className="app-header__logo">
        <span className="app-header__logo-mark">⚖️</span>
        <span>밸런스게임</span>
      </Link>
      <nav className="app-header__nav">
        {profile?.nickname && (
          <Link to="/mypage" className="app-header__nickname">
            {profile.nickname}님
          </Link>
        )}
        <Link to="/submit">문제 등록</Link>
        <Link to="/hall-of-fame">명예의전당</Link>
        {isAdmin && <span className="app-header__nickname">관리자</span>}
        {isAdmin && <Link to="/admin">관리자 페이지</Link>}
      </nav>
    </header>
  );
}
