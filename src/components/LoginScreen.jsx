import React from "react";
import { useSession } from "../hooks/useSession";

export default function LoginScreen() {
  const { signInWithKakao } = useSession();

  return (
    <div className="login-screen__backdrop">
      <div className="login-screen">
        <div className="login-screen__brand">⚖️</div>
        <h2>밸런스게임</h2>
        <p className="login-screen__desc">카카오 계정으로 간편하게 시작해보세요.</p>

        <button className="login-screen__kakao" onClick={signInWithKakao} type="button">
          <span className="login-screen__kakao-icon">💬</span>
          카카오로 시작하기
        </button>
      </div>
    </div>
  );
}
