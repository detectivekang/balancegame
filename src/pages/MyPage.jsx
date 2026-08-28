import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useSession } from "../hooks/useSession";
import { MAX_LEVEL } from "../utils/levels";
import { uploadAvatarImage } from "../utils/image";
import LoadingScreen from "../components/LoadingScreen";
import MyVotesModal from "../components/MyVotesModal";

const STATUS_LABEL = { approved: "✅ 승인됨", pending: "⏳ 승인 대기" };

export default function MyPage() {
  const { user, profile, player, streak, signOut, updateAvatar } = useSession();
  const [loading, setLoading] = useState(true);
  const [voteCount, setVoteCount] = useState(0);
  const [mySets, setMySets] = useState([]);
  const [myWorldcups, setMyWorldcups] = useState([]);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState(null);
  const [showVotesModal, setShowVotesModal] = useState(false);
  const avatarInputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [{ count: votes }, { data: sets }, { data: worldcups }] = await Promise.all([
        supabase.from("votes").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase
          .from("question_sets")
          .select("*")
          .eq("creator_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("worldcups")
          .select("*")
          .eq("creator_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      if (cancelled) return;

      const setIds = (sets || []).map((s) => s.id);
      const wcIds = (worldcups || []).map((w) => w.id);

      const [{ data: setQuestions }, { data: wcItems }] = await Promise.all([
        setIds.length > 0
          ? supabase.from("questions").select("set_id").in("set_id", setIds)
          : Promise.resolve({ data: [] }),
        wcIds.length > 0
          ? supabase.from("worldcup_items").select("worldcup_id").in("worldcup_id", wcIds)
          : Promise.resolve({ data: [] }),
      ]);

      if (cancelled) return;

      const setCountMap = {};
      (setQuestions || []).forEach((q) => (setCountMap[q.set_id] = (setCountMap[q.set_id] || 0) + 1));
      const wcCountMap = {};
      (wcItems || []).forEach((it) => (wcCountMap[it.worldcup_id] = (wcCountMap[it.worldcup_id] || 0) + 1));

      setVoteCount(votes || 0);
      setMySets((sets || []).map((s) => ({ ...s, questionCount: setCountMap[s.id] || 0 })));
      setMyWorldcups((worldcups || []).map((w) => ({ ...w, itemCount: wcCountMap[w.id] || 0 })));
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  const handleAvatarClick = () => {
    if (!avatarUploading) avatarInputRef.current?.click();
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setAvatarUploading(true);
    setAvatarError(null);
    try {
      // 아주 작은 정사각형(128px)으로 리사이즈해서 업로드
      const avatarUrl = await uploadAvatarImage(supabase, file);
      await updateAvatar(avatarUrl);
    } catch (err) {
      console.error("프로필 사진 업로드 실패:", err);
      setAvatarError("사진 업로드에 실패했어요. 다시 시도해주세요.");
    } finally {
      setAvatarUploading(false);
    }
  };

  if (loading || !player) return <LoadingScreen label="마이페이지를 불러오는 중" />;

  const { level, tier, xp, progress, cap, currentEnergy, isPremium } = player;
  const xpPercent = progress ? Math.min(100, Math.round((progress.current / progress.needed) * 100)) : 100;

  return (
    <div className="page page--home">
      <div className="mypage-profile">
        <div className="mypage-profile__top">
          <button
            type="button"
            className="mypage-avatar"
            onClick={handleAvatarClick}
            disabled={avatarUploading}
            title="프로필 사진 변경"
          >
            {profile.avatar_url ? (
              <img className="mypage-avatar__img" src={profile.avatar_url} alt="" />
            ) : (
              <span className="mypage-avatar__placeholder">👤</span>
            )}
            <span className="mypage-avatar__edit">{avatarUploading ? "…" : "📷"}</span>
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleAvatarChange}
          />
          <span className="mypage-profile__tier" style={{ background: tier.color }}>
            {tier.label}
          </span>
          <span className="mypage-profile__nickname">{profile.nickname}님</span>
          {isPremium && <span className="mypage-profile__premium">👑 무제한</span>}
        </div>
        {avatarError && <p className="mypage-avatar__error">⚠️ {avatarError}</p>}
        <div className="mypage-profile__level">
          Lv.{level}
          {level >= MAX_LEVEL && " (MAX)"}
        </div>
        {progress && (
          <>
            <div className="player-status__xp-track">
              <div className="player-status__xp-fill" style={{ width: `${xpPercent}%` }} />
            </div>
            <div className="mypage-profile__xp-label">
              {progress.current} / {progress.needed} XP (총 {xp} XP)
            </div>
          </>
        )}
        <div className="mypage-profile__meta">
          ⚡ {currentEnergy}/{cap} · 🔥 {streak}일 연속 · 가입일 {profile.first_seen_date}
        </div>
      </div>

      <div className="mypage-stats">
        <button
          type="button"
          className="mypage-stats__item mypage-stats__item--clickable"
          onClick={() => voteCount > 0 && setShowVotesModal(true)}
          disabled={voteCount === 0}
        >
          <div className="mypage-stats__value">{voteCount.toLocaleString()}</div>
          <div className="mypage-stats__label">총 참여 문제</div>
        </button>
        <div className="mypage-stats__item">
          <div className="mypage-stats__value">{mySets.length}</div>
          <div className="mypage-stats__label">만든 문제집</div>
        </div>
        <div className="mypage-stats__item">
          <div className="mypage-stats__value">{myWorldcups.length}</div>
          <div className="mypage-stats__label">만든 월드컵</div>
        </div>
      </div>

      {showVotesModal && <MyVotesModal userId={user.id} onClose={() => setShowVotesModal(false)} />}

      <h3 className="deck-row__title">📚 내가 만든 문제집</h3>
      {mySets.length === 0 && <p className="empty-state">아직 만든 문제집이 없어요.</p>}
      <div className="mypage-list">
        {mySets.map((s) => (
          <div key={s.id} className="mypage-list__item">
            <span className="mypage-list__emoji">{s.emoji || "🎯"}</span>
            <div className="mypage-list__info">
              <div className="mypage-list__title">{s.title}</div>
              <div className="mypage-list__meta">
                {s.category} · 문제 {s.questionCount}개
              </div>
            </div>
            <span className={`mypage-list__status is-${s.status}`}>{STATUS_LABEL[s.status] || s.status}</span>
          </div>
        ))}
      </div>

      <h3 className="deck-row__title">🏆 내가 만든 월드컵</h3>
      {myWorldcups.length === 0 && <p className="empty-state">아직 만든 월드컵이 없어요.</p>}
      <div className="mypage-list">
        {myWorldcups.map((w) => (
          <div key={w.id} className="mypage-list__item">
            <span className="mypage-list__emoji">🏆</span>
            <div className="mypage-list__info">
              <div className="mypage-list__title">{w.title}</div>
              <div className="mypage-list__meta">
                {w.category} · 후보 {w.itemCount}명
              </div>
            </div>
            <span className={`mypage-list__status is-${w.status}`}>{STATUS_LABEL[w.status] || w.status}</span>
          </div>
        ))}
      </div>

      <Link to="/upgrade" className="mypage-upgrade-link">
        👑 {isPremium ? "무제한 이용권 이용중" : "무제한 이용권 보기"}
      </Link>

      <button className="mypage-logout" onClick={signOut}>
        로그아웃
      </button>
    </div>
  );
}
