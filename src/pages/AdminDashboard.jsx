import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { AGE_BUCKETS, GENDERS } from "../data/demographics";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

async function count(table, build) {
  let q = supabase.from(table).select("*", { count: "exact", head: true });
  if (build) q = build(q);
  const { count: c, error } = await q;
  if (error) {
    console.error(error);
    return 0;
  }
  return c || 0;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [demographics, setDemographics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const today = todayStr();

        const [totalUsers, todaySignups, dau, totalQuestions, pendingQuestions] = await Promise.all([
          count("profiles"),
          count("profiles", (q) => q.eq("first_seen_date", today)),
          count("daily_active", (q) => q.eq("date", today)),
          count("questions", (q) => q.eq("status", "approved")),
          count("questions", (q) => q.eq("status", "pending")),
        ]);

        setStats({ totalUsers, todaySignups, dau, totalQuestions, pendingQuestions });

        const genderCounts = await Promise.all(
          GENDERS.map((g) => count("profiles", (q) => q.eq("gender", g)))
        );
        const ageCounts = await Promise.all(
          AGE_BUCKETS.map((b) =>
            count("profiles", (q) => q.gte("age", b.min).lt("age", b.max))
          )
        );

        setDemographics({
          gender: GENDERS.map((g, i) => ({ label: g, count: genderCounts[i] })),
          age: AGE_BUCKETS.map((b, i) => ({ label: b.label, count: ageCounts[i] })),
        });
      } catch (err) {
        console.error("통계 로딩 실패:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <p>통계를 불러오는 중...</p>;
  if (!stats) return <p>통계를 불러오지 못했습니다.</p>;

  const cards = [
    { label: "누적 유저 수", value: stats.totalUsers },
    { label: "오늘 가입자", value: stats.todaySignups },
    { label: "일일 활성 사용자(DAU)", value: stats.dau },
    { label: "등록된 총 문제 수", value: stats.totalQuestions },
    { label: "승인 대기 문제", value: stats.pendingQuestions },
  ];

  const maxAge = demographics ? Math.max(1, ...demographics.age.map((a) => a.count)) : 1;
  const maxGender = demographics ? Math.max(1, ...demographics.gender.map((g) => g.count)) : 1;

  return (
    <div>
      <div className="admin-dashboard">
        {cards.map((c) => (
          <div key={c.label} className="admin-dashboard__card">
            <div className="admin-dashboard__value">{c.value.toLocaleString()}</div>
            <div className="admin-dashboard__label">{c.label}</div>
          </div>
        ))}
      </div>

      {demographics && (
        <div className="admin-demographics">
          <h4>성별 분포</h4>
          <div className="admin-demographics__bars">
            {demographics.gender.map((g) => (
              <div key={g.label} className="admin-demographics__row">
                <span className="admin-demographics__label">{g.label}</span>
                <div className="admin-demographics__track">
                  <div
                    className="admin-demographics__fill"
                    style={{ width: `${(g.count / maxGender) * 100}%` }}
                  />
                </div>
                <span className="admin-demographics__count">{g.count}</span>
              </div>
            ))}
          </div>

          <h4>연령대 분포</h4>
          <div className="admin-demographics__bars">
            {demographics.age.map((a) => (
              <div key={a.label} className="admin-demographics__row">
                <span className="admin-demographics__label">{a.label}</span>
                <div className="admin-demographics__track">
                  <div
                    className="admin-demographics__fill"
                    style={{ width: `${(a.count / maxAge) * 100}%` }}
                  />
                </div>
                <span className="admin-demographics__count">{a.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
