import { useEffect, useState } from "react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { energyCapForLevel } from "../utils/levels";

export function getDeviceId() {
  let id = localStorage.getItem("bg_device_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("bg_device_id", id);
  }
  return id;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

// 날짜가 바뀔 때마다 dailyActive 컬렉션에 기록. (DAU 집계용, 가입 여부와 무관하게 항상 동작)
export function useDevice() {
  const [deviceId] = useState(getDeviceId);

  useEffect(() => {
    const trackVisit = async () => {
      try {
        const lastActive = localStorage.getItem("bg_last_active_date");
        const today = todayStr();
        if (lastActive !== today) {
          const activeRef = doc(db, "dailyActive", `${today}_${deviceId}`);
          await setDoc(activeRef, { date: today, deviceId });
          localStorage.setItem("bg_last_active_date", today);
        }
      } catch (err) {
        console.error("방문 기록 실패:", err);
      }
    };
    trackVisit();
  }, [deviceId]);

  return deviceId;
}

// 회원가입 완료 여부 - 기기당 한 번만 물어봄 (닉네임/나이/성별 필수)
export function needsSignup() {
  return localStorage.getItem("bg_signed_up") !== "1";
}

export function getNickname() {
  return localStorage.getItem("bg_nickname") || "";
}

// 가입 완료 시 users 컬렉션에 프로필 생성. "오늘 가입자"/"누적 유저 수" 집계의 기준.
// xp/energy는 레벨 시스템의 시작값(레벨1, 경험치0, 에너지는 레벨1 최대치로 가득 채움)
export async function completeSignup(deviceId, { nickname, age, gender }) {
  const userRef = doc(db, "users", deviceId);
  await setDoc(userRef, {
    nickname,
    age,
    gender,
    firstSeenDate: todayStr(),
    createdAt: serverTimestamp(),
    xp: 0,
    energy: energyCapForLevel(1),
    energyUpdatedAt: serverTimestamp(),
  });
  localStorage.setItem("bg_signed_up", "1");
  localStorage.setItem("bg_nickname", nickname);
}

export function hasVoted(questionId) {
  const voted = JSON.parse(localStorage.getItem("bg_voted") || "{}");
  return Boolean(voted[questionId]);
}

export function markVoted(questionId, choice) {
  const voted = JSON.parse(localStorage.getItem("bg_voted") || "{}");
  voted[questionId] = choice;
  localStorage.setItem("bg_voted", JSON.stringify(voted));
}

export function getVotedChoice(questionId) {
  const voted = JSON.parse(localStorage.getItem("bg_voted") || "{}");
  return voted[questionId] || null;
}
