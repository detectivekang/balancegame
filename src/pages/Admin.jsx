import React, { useState } from "react";
import { useSession } from "../hooks/useSession";
import AdminLogin from "./AdminLogin";
import AdminDashboard from "./AdminDashboard";
import AdminApprovals from "./AdminApprovals";
import AdminExcelUpload from "./AdminExcelUpload";
import AdminPlayers from "./AdminPlayers";
import AdminSets from "./AdminSets";
import AdminWorldcups from "./AdminWorldcups";
import AdminReports from "./AdminReports";

const TABS = [
  { key: "dashboard", label: "대시보드" },
  { key: "players", label: "플레이어" },
  { key: "sets", label: "문제집 관리" },
  { key: "approvals", label: "승인 관리" },
  { key: "worldcups", label: "월드컵 승인" },
  { key: "reports", label: "신고 관리" },
  { key: "excel", label: "엑셀 업로드" },
];

export default function Admin() {
  const { user, isAdmin, loading, signOut } = useSession();
  const [tab, setTab] = useState("dashboard");

  if (loading) return <p className="page">확인 중...</p>;
  if (!user || !isAdmin) return <AdminLogin />;

  return (
    <div className="page page--admin">
      <div className="admin-top">
        <div className="admin-tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`admin-tabs__item ${tab === t.key ? "is-active" : ""}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button className="admin-top__logout" onClick={signOut}>
          로그아웃
        </button>
      </div>

      {tab === "dashboard" && <AdminDashboard />}
      {tab === "players" && <AdminPlayers />}
      {tab === "sets" && <AdminSets />}
      {tab === "approvals" && <AdminApprovals />}
      {tab === "worldcups" && <AdminWorldcups />}
      {tab === "reports" && <AdminReports />}
      {tab === "excel" && <AdminExcelUpload />}
    </div>
  );
}
