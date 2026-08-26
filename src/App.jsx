import React from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import LoginScreen from "./components/LoginScreen";
import ProfileSetupModal from "./components/ProfileSetupModal";
import LevelUpModal from "./components/LevelUpModal";
import Home from "./pages/Home";
import Submit from "./pages/Submit";
import Admin from "./pages/Admin";
import HallOfFame from "./pages/HallOfFame";
import { SessionProvider, useSession } from "./hooks/useSession";
import "./App.css";

// /admin 은 카카오 로그인과 별개로 자체 이메일/비밀번호 로그인을 쓰기 때문에
// 아래 PlayerArea의 "카카오 로그인 필요" 게이트 밖에 따로 둡니다.
function PlayerArea() {
  const { session, loading, needsProfileSetup } = useSession();

  if (loading) return <div className="page">불러오는 중...</div>;
  if (!session) return <LoginScreen />;
  if (needsProfileSetup) return <ProfileSetupModal />;

  return (
    <>
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/submit" element={<Submit />} />
          <Route path="/hall-of-fame" element={<HallOfFame />} />
        </Routes>
      </main>
      <LevelUpModal />
    </>
  );
}

function AdminArea() {
  return (
    <>
      <Header />
      <main>
        <Admin />
      </main>
    </>
  );
}

export default function App() {
  return (
    <SessionProvider>
      {/* GitHub Pages는 새로고침 시 404가 나기 쉬워서 BrowserRouter 대신 HashRouter 사용.
          카카오 로그인은 PKCE(?code=) 방식이라 해시 라우팅과 충돌하지 않습니다. */}
      <HashRouter>
        <Routes>
          <Route path="/admin" element={<AdminArea />} />
          <Route path="/*" element={<PlayerArea />} />
        </Routes>
      </HashRouter>
    </SessionProvider>
  );
}
