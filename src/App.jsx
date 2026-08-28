import React, { Suspense, lazy } from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import LoginScreen from "./components/LoginScreen";
import ProfileSetupModal from "./components/ProfileSetupModal";
import LevelUpModal from "./components/LevelUpModal";
import LoadingScreen from "./components/LoadingScreen";
import ModeTabs from "./components/ModeTabs";
import UpdateBanner from "./components/UpdateBanner";
import InstallPrompt from "./components/InstallPrompt";
import Home from "./pages/Home";
import { SessionProvider, useSession } from "./hooks/useSession";
import "./App.css";

// 관리자 페이지/엑셀 업로드(xlsx 라이브러리 포함)처럼 대부분의 유저는 아예 안 여는 화면은
// 지연 로딩해서 첫 진입(홈 화면) 번들 크기를 줄임.
const Submit = lazy(() => import("./pages/Submit"));
const Admin = lazy(() => import("./pages/Admin"));
const HallOfFame = lazy(() => import("./pages/HallOfFame"));
const Upgrade = lazy(() => import("./pages/Upgrade"));
const UpgradeSuccess = lazy(() =>
  import("./pages/UpgradeResult").then((m) => ({ default: m.UpgradeSuccess }))
);
const UpgradeFail = lazy(() =>
  import("./pages/UpgradeResult").then((m) => ({ default: m.UpgradeFail }))
);
const WorldCup = lazy(() => import("./pages/WorldCup"));
const WorldCupSubmit = lazy(() => import("./pages/WorldCupSubmit"));
const ChemistryPage = lazy(() => import("./pages/ChemistryPage"));
const WorldCupResultPage = lazy(() => import("./pages/WorldCupResultPage"));
const MyPage = lazy(() => import("./pages/MyPage"));

// /admin 은 카카오 로그인과 별개로 자체 이메일/비밀번호 로그인을 쓰기 때문에
// 아래 PlayerArea의 "카카오 로그인 필요" 게이트 밖에 따로 둡니다.
function PlayerArea() {
  const { session, loading, needsProfileSetup } = useSession();

  if (loading) return <LoadingScreen />;
  if (!session) return <LoginScreen />;
  if (needsProfileSetup) return <ProfileSetupModal />;

  return (
    <>
      <Header />
      <ModeTabs />
      <InstallPrompt />
      <main>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/submit" element={<Submit />} />
            <Route path="/hall-of-fame" element={<HallOfFame />} />
            <Route path="/upgrade" element={<Upgrade />} />
            <Route path="/upgrade/success" element={<UpgradeSuccess />} />
            <Route path="/upgrade/fail" element={<UpgradeFail />} />
            <Route path="/worldcup" element={<WorldCup />} />
            <Route path="/worldcup/submit" element={<WorldCupSubmit />} />
            <Route path="/mypage" element={<MyPage />} />
          </Routes>
        </Suspense>
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
        <Suspense fallback={<LoadingScreen />}>
          <Admin />
        </Suspense>
      </main>
    </>
  );
}

export default function App() {
  return (
    <SessionProvider>
      {/* GitHub Pages는 새로고침 시 404가 나기 쉬워서 BrowserRouter 대신 HashRouter 사용.
          카카오 로그인은 PKCE(?code=) 방식이라 해시 라우팅과 충돌하지 않습니다. */}
      <UpdateBanner />
      <HashRouter>
        <Routes>
          <Route path="/admin" element={<AdminArea />} />
          {/* 궁합 테스트 초대 링크는 로그인 없이 바로 열리고 풀 수 있어야 함(호기심 유지가
              핵심). 상세 결과를 보거나 초대한 사람이 알 수 있게 기록하는 시점에만
              ChemistryPage 안에서 자체적으로 로그인을 유도함. 그래서 PlayerArea의
              "카카오 로그인 필요" 게이트 밖에 둠. */}
          <Route
            path="/chemistry/:resultId"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <ChemistryPage />
              </Suspense>
            }
          />
          {/* 월드컵 결과 공유 링크도 같은 이유로 로그인 게이트 밖에 둠 - PNG 한 장이
              아니라 클릭 가능한 결과 카드로, 로그인 없이 바로 보이고 "나도 도전하기"로
              이어지게 함. */}
          <Route
            path="/worldcup/result/:resultId"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <WorldCupResultPage />
              </Suspense>
            }
          />
          <Route path="/*" element={<PlayerArea />} />
        </Routes>
      </HashRouter>
    </SessionProvider>
  );
}
