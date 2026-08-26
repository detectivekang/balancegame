// daily_active 기록을 바탕으로 "오늘까지 며칠 연속 접속했는지" 계산.
// 표시용 클라이언트 계산이며, 실제 보상 지급 시에는 서버(claim_streak_bonus)가 다시 검증함.
export function computeStreak(dailyActiveDates) {
  const dateSet = new Set(dailyActiveDates);
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    if (!dateSet.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export const STREAK_MILESTONES = [3, 7, 14, 30];

export function nextStreakMilestone(streak) {
  return STREAK_MILESTONES.find((m) => m > streak) || null;
}
