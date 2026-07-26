import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase, ADMIN_EMAIL } from "../lib/supabaseClient";
import {
  energyCapForLevel,
  ENERGY_REGEN_MS,
  levelForXp,
  tierForLevel,
  xpToNextLevel,
} from "../utils/levels";

const SessionContext = createContext(null);

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function SessionProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = 로딩중, null = 비로그인
  const [profile, setProfile] = useState(null); // undefined 아님: 아직 안 불러왔으면 null
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [now, setNow] = useState(Date.now());

  // 세션 로드 + 변경 감지
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // 세션이 생기면 프로필 로드 + 오늘 방문 기록
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) {
      setProfile(null);
      setProfileLoaded(session === null); // 비로그인 상태면 "로드 완료"로 처리
      return;
    }

    let cancelled = false;
    setProfileLoaded(false);

    supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle()
      .then(async ({ data, error }) => {
        if (cancelled) return;
        if (error) console.error("프로필 로딩 실패:", error);
        setProfile(data || null);
        setProfileLoaded(true);

        if (data) {
          // 오늘 방문 기록(DAU) - 실패해도 무시
          await supabase
            .from("daily_active")
            .upsert({ user_id: userId, date: todayStr() }, { onConflict: "user_id,date" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session]);

  // 에너지 회복 카운트다운 갱신용
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  const isAdmin = session?.user?.email === ADMIN_EMAIL;

  const player = useMemo(() => {
    if (!profile) return null;
    const xp = profile.xp || 0;
    const level = levelForXp(xp);
    const cap = energyCapForLevel(level);
    const updatedAtMs = new Date(profile.energy_updated_at).getTime();
    const elapsedMs = Math.max(0, now - updatedAtMs);
    const regen = Math.floor(elapsedMs / ENERGY_REGEN_MS);
    const currentEnergy = Math.min(cap, (profile.energy || 0) + regen);
    const msUntilNext =
      currentEnergy >= cap ? null : ENERGY_REGEN_MS - (elapsedMs % ENERGY_REGEN_MS);

    return {
      xp,
      level,
      tier: tierForLevel(level),
      cap,
      currentEnergy,
      msUntilNext,
      progress: xpToNextLevel(level, xp),
    };
  }, [profile, now]);

  const signInWithKakao = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: { redirectTo: window.location.origin + window.location.pathname },
    });
  };

  const signInAdmin = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const completeProfile = async ({ nickname, age, gender }) => {
    const userId = session.user.id;
    const { data, error } = await supabase
      .from("profiles")
      .insert({ id: userId, nickname, age, gender })
      .select()
      .single();
    if (error) throw error;
    setProfile(data);
  };

  // 투표 1건 처리 - 서버 함수(cast_vote)가 에너지 체크/중복투표 방지/XP 지급까지 원자적으로 처리
  const castVote = async (questionId, choice) => {
    const { data, error } = await supabase
      .rpc("cast_vote", { p_question_id: questionId, p_choice: choice })
      .single();
    if (error) throw error;
    setProfile((prev) => (prev ? { ...prev, xp: data.xp, energy: data.energy } : prev));
    return data; // { votes_a, votes_b, xp, energy }
  };

  const value = {
    session,
    user: session?.user || null,
    loading: session === undefined || !profileLoaded,
    isAdmin,
    profile,
    needsProfileSetup: Boolean(session?.user) && profileLoaded && !profile,
    player,
    signInWithKakao,
    signInAdmin,
    signOut,
    completeProfile,
    castVote,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
