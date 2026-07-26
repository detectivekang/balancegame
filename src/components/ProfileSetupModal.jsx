import React, { useState } from "react";
import { GENDERS } from "../data/demographics";
import { useSession } from "../hooks/useSession";

export default function ProfileSetupModal() {
  const { completeProfile, user } = useSession();
  const [nickname, setNickname] = useState(user?.user_metadata?.nickname || "");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const trimmedNickname = nickname.trim();
    const ageNum = Number(age);

    if (!trimmedNickname) {
      setError("닉네임을 입력해주세요.");
      return;
    }
    if (!age || !Number.isInteger(ageNum) || ageNum < 1 || ageNum > 110) {
      setError("나이를 올바르게 입력해주세요.");
      return;
    }
    if (!gender) {
      setError("성별을 선택해주세요.");
      return;
    }

    setSubmitting(true);
    try {
      await completeProfile({ nickname: trimmedNickname, age: ageNum, gender });
    } catch (err) {
      console.error("프로필 생성 실패:", err);
      setError("가입에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="signup-modal__backdrop">
      <form className="signup-modal" onSubmit={handleSubmit}>
        <div className="signup-modal__brand">⚖️</div>
        <h2>프로필을 완성해주세요</h2>
        <p className="signup-modal__desc">카카오 로그인 완료! 시작 전에 몇 가지만 알려주세요.</p>

        <label className="signup-modal__field">
          닉네임
          <input
            type="text"
            placeholder="예: 밸런스요정"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={12}
          />
        </label>

        <label className="signup-modal__field">
          나이
          <input
            type="number"
            placeholder="예: 27"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            min={1}
            max={110}
          />
        </label>

        <div className="signup-modal__field">
          <span>성별</span>
          <div className="signup-modal__options">
            {GENDERS.map((g) => (
              <button
                key={g}
                type="button"
                className={gender === g ? "is-selected" : ""}
                onClick={() => setGender(g)}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="signup-modal__error">{error}</p>}

        <button className="signup-modal__submit" type="submit" disabled={submitting}>
          {submitting ? "가입 중..." : "시작하기"}
        </button>
      </form>
    </div>
  );
}
