import React from "react";

// 앱 전역에서 쓰는 로딩 화면. 텍스트 한 줄 대신 로고 펄스 + 스피너로 "불러오는 중" 느낌을 냄.
export default function LoadingScreen({ label = "불러오는 중" }) {
  return (
    <div className="loading-screen">
      <div className="loading-screen__logo">⚖️</div>
      <div className="loading-screen__spinner" />
      <p className="loading-screen__label">{label}</p>
    </div>
  );
}
