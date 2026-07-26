import React, { useState } from "react";
import { AGE_RANGES, GENDERS } from "../data/demographics";
import { completeOnboarding } from "../hooks/useDevice";

export default function OnboardingModal({ deviceId, onDone }) {
  const [ageRange, setAgeRange] = useState("");
  const [gender, setGender] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (skip) => {
    setSubmitting(true);
    try {
      await completeOnboarding(deviceId, {
        ageRange: skip ? "응답 안 함" : ageRange || "응답 안 함",
        gender: skip ? "응답 안 함" : gender || "응답 안 함",
      });
    } catch (err) {
      console.error("온보딩 저장 실패:", err);
      // 실패해도 게임은 계속 진행할 수 있게 로컬 플래그는 넘어가지 않고 그냥 닫음
    } finally {
      setSubmitting(false);
      onDone();
    }
  };

  return (
    <div className="onboarding-modal__backdrop">
      <div className="onboarding-modal">
        <h3>시작하기 전에</h3>
        <p className="onboarding-modal__desc">
          더 재밌는 통계를 보여드리기 위해 연령대와 성별을 물어봐요. (선택 사항)
        </p>

        <div className="onboarding-modal__field">
          <span>연령대</span>
          <div className="onboarding-modal__options">
            {AGE_RANGES.filter((a) => a !== "응답 안 함").map((a) => (
              <button
                key={a}
                className={ageRange === a ? "is-selected" : ""}
                onClick={() => setAgeRange(a)}
                type="button"
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        <div className="onboarding-modal__field">
          <span>성별</span>
          <div className="onboarding-modal__options">
            {GENDERS.filter((g) => g !== "응답 안 함").map((g) => (
              <button
                key={g}
                className={gender === g ? "is-selected" : ""}
                onClick={() => setGender(g)}
                type="button"
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <div className="onboarding-modal__actions">
          <button
            className="onboarding-modal__skip"
            onClick={() => handleSubmit(true)}
            disabled={submitting}
            type="button"
          >
            건너뛰기
          </button>
          <button
            className="onboarding-modal__submit"
            onClick={() => handleSubmit(false)}
            disabled={submitting}
            type="button"
          >
            시작하기
          </button>
        </div>
      </div>
    </div>
  );
}
