import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase, ADMIN_EMAIL } from "../lib/supabaseClient";
import {
  energyCapForLevel,
  ENERGY_REGEN_MS,
  levelForXp,
  tierForLevel,
  xpToNextLevel,
} from "../utils/levels";
import { computeStreak } from "../utils/streak";
import { trackEvent } from "../utils/analytics";

const SessionContext = createContext(null);

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function isPremiumActive(profile) {
  if (!profile?.is_premium) return false;
  if (!profile.premium_until) return true; // 만료일 없으면 영구(관리자가 수동 부여한 경우 등)
  return new Date(profile.premium_until).getTime() > Date.now();
}

export function SessionProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = 로딩중, null = 비로그인
  const [profile, setProfile] = useState(null); // undefined 아님: 아직 안 불러왔으면 null
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [streak, setStreak] = useState(0);
  const [claimedMilestones, setClaimedMilestones] = useState([]);
  const [levelUpInfo, setLevelUpInfo] = useState(null); // { level } | null
  const prevLevelRef = useRef(null);

  // 세션 로드 + 변경 감지
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (_event === "SIGNED_IN") trackEvent("login", { method: "kakao" });
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
        if (data) prevLevelRef.current = levelForXp(data.xp || 0); // 최초 로드시 레벨업 팝업 안 뜨게 기준값 저장

        if (data) {
          // 오늘 방문 기록(DAU) - 실패해도 무시
          await supabase
            .from("daily_active")
            .upsert({ user_id: userId, date: todayStr() }, { onConflict: "user_id,date" });

          // 최근 40일 방문 기록으로 연속 출석일 계산 (표시용, 서버가 보상 지급 시 재검증)
          const since = new Date();
          since.setDate(since.getDate() - 40);
          const { data: activeDays } = await supabase
            .from("daily_active")
            .select("date")
            .eq("user_id", userId)
            .gte("date", since.toISOString().slice(0, 10));
          if (!cancelled) {
            setStreak(computeStreak((activeDays || []).map((r) => r.date)));
          }

          // 이미 받은 출석 보너스 마일스톤 목록 (버튼을 다시 눌러 중복 요청하는 것을 막기 위함)
          const { data: claims } = await supabase
            .from("streak_bonus_claims")
            .select("milestone")
            .eq("user_id", userId);
          if (!cancelled) {
            setClaimedMilestones((claims || []).map((c) => c.milestone));
          }
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

  // 관리자가 다른 세션에서 무제한 이용권 등을 바꿔도 반영되도록 주기적으로 + 탭 복귀 시 프로필 재조회
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;

    const refresh = () => {
      supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setProfile(data);
        });
    };

    const t = setInterval(refresh, 30000);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [session]);

  const isAdmin = session?.user?.email === ADMIN_EMAIL;

  const premium = isPremiumActive(profile);

  const player = useMemo(() => {
    if (!profile) return null;
    const xp = profile.xp || 0;
    const level = levelForXp(xp);
    const cap = energyCapForLevel(level);
    const updatedAtMs = new Date(profile.energy_updated_at).getTime();
    const elapsedMs = Math.max(0, now - updatedAtMs);
    const regen = Math.floor(elapsedMs / ENERGY_REGEN_MS);
    const currentEnergy = premium ? cap : Math.min(cap, (profile.energy || 0) + regen);
    const msUntilNext =
      premium || currentEnergy >= cap ? null : ENERGY_REGEN_MS - (elapsedMs % ENERGY_REGEN_MS);

    return {
      xp,
      level,
      tier: tierForLevel(level),
      cap,
      currentEnergy,
      msUntilNext,
      progress: xpToNextLevel(level, xp),
      isPremium: premium,
    };
  }, [profile, now, premium]);

  // 레벨업 감지 -> 레벨업 연출 트리거
  useEffect(() => {
    if (!player) return;
    if (prevLevelRef.current === null) {
      prevLevelRef.current = player.level;
      return;
    }
    if (player.level > prevLevelRef.current) {
      setLevelUpInfo({ level: player.level, tier: player.tier });
    }
    prevLevelRef.current = player.level;
  }, [player]);

  const dismissLevelUp = () => setLevelUpInfo(null);

  const signInWithKakao = async () => {
    // 카카오 로그인 후 돌아올 때 현재 해시 경로(#/chemistry/xxx 같은 초대 링크 등)를
    // 그대로 유지해야 함. 예전에는 pathname까지만 넘겨서 초대 링크로 들어온 사람이
    // 로그인하자마자 홈으로 이동해버리고 초대가 날아가는 문제가 있었음.
    // (PKCE 방식이라 콜백에 ?code=... 쿼리스트링이 붙는 것뿐이라 해시 라우팅과 충돌 없음)
    await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: {
        redirectTo: window.location.origin + window.location.pathname + window.location.hash,
      },
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
    trackEvent("sign_up", { method: "kakao" }); // 프로필 생성 = 진짜 신규 가입 완료 시점
  };

  // 프로필 사진 URL 저장 (마이페이지에서 리사이즈된 이미지를 업로드한 뒤 호출)
  const updateAvatar = async (avatarUrl) => {
    const userId = session.user.id;
    const { data, error } = await supabase
      .from("profiles")
      .update({ avatar_url: avatarUrl })
      .eq("id", userId)
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

  // 리워드 광고 시청 완료 콜백에서 호출 - 하루 5회까지 에너지 +3.
  // ⚠️ 실제 서비스에서는 광고 SDK(AdMob/카카오 AdFit 등)의 "보상형 광고 시청 완료" 콜백
  //   안에서만 이 함수를 호출해야 함. 지금은 광고 SDK가 연결되어 있지 않아
  //   AdWatchModal에서 시뮬레이션(로딩 후 자동완료)으로 대체돼 있음 - 실제 SDK 연동 시 그 부분만 교체하면 됨.
  const claimAdEnergy = async () => {
    const { data, error } = await supabase.rpc("claim_ad_energy").single();
    if (error) throw error;
    setProfile((prev) => (prev ? { ...prev, energy: data.energy } : prev));
    trackEvent("ad_reward_claimed", { energy: data.energy });
    return data; // { energy, cap, remaining_today }
  };

  // 출석 스트릭 마일스톤(3/7/14/30일) 보너스 수령
  const claimStreakBonus = async (milestone) => {
    const { data, error } = await supabase.rpc("claim_streak_bonus", { p_milestone: milestone }).single();
    if (error) {
      // 이미 받은 마일스톤(unique 제약 위반) - 화면에 계속 남아있던 버튼을 다시 눌렀을 때.
      // 실패로 취급하지 않고 "이미 받음" 상태로 조용히 정리해서 버튼이 사라지게 함.
      if (error.code === "23505") {
        setClaimedMilestones((prev) => (prev.includes(milestone) ? prev : [...prev, milestone]));
        return null;
      }
      throw error;
    }
    setProfile((prev) => (prev ? { ...prev, energy: data.energy } : prev));
    setClaimedMilestones((prev) => (prev.includes(milestone) ? prev : [...prev, milestone]));
    return data; // { energy, cap }
  };

  // 이상형 월드컵 입장 - 매치마다가 아니라 시작할 때 한 번만 에너지를 소모함.
  // (프리미엄 유저는 서버 함수가 알아서 무료 처리)
  // worldcupId를 같이 넘기면 "실시간 인기 랭킹" 집계용으로 플레이 시각이 기록됨.
  const startWorldcupSession = async (cost = 10, worldcupId = null) => {
    const { data, error } = await supabase
      .rpc("start_worldcup", { p_cost: cost, p_worldcup_id: worldcupId })
      .single();
    if (error) throw error;
    setProfile((prev) => (prev ? { ...prev, energy: data.energy } : prev));
    return data; // { energy, cap }
  };

  const value = {
    session,
    user: session?.user || null,
    loading: session === undefined || !profileLoaded,
    isAdmin,
    profile,
    needsProfileSetup: Boolean(session?.user) && profileLoaded && !profile,
    player,
    streak,
    claimedMilestones,
    levelUpInfo,
    dismissLevelUp,
    signInWithKakao,
    signInAdmin,
    signOut,
    completeProfile,
    updateAvatar,
    castVote,
    claimAdEnergy,
    claimStreakBonus,
    startWorldcupSession,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
