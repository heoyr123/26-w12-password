/**
 * 비밀번호 강도 분석 유틸리티 (브라우저 로컬 전용)
 * 외부 네트워크 통신 없이 브라우저 메모리 내에서 순수 계산합니다.
 */

// 흔한 취약 패턴 정규식 (대소문자 무관)
const COMMON_PATTERNS = [
  /1234/i,
  /qwer/i,
  /asdf/i,
  /password/i,
  /admin/i,
  /qwerty/i,
  /zxcv/i,
  /0000/i,
  /1111/i,
];

// 동일 문자 3회 이상 연속 반복 정규식 (예: aaa, 111, !!!)
const REPEATED_CHARS = /(.)\1{2,}/;

/**
 * 비밀번호 강도를 분석하고 0~100점의 점수 및 세부 체크리스트를 반환합니다.
 * @param {string} password 
 * @returns {object} 강도 점수, 단계, 체크리스트 상세 결과
 */
export function evaluatePasswordStrength(password) {
  if (!password || typeof password !== 'string') {
    return {
      score: 0,
      level: 'none',
      label: '비밀번호를 입력하세요',
      color: 'neutral',
      checks: {
        length8: false,
        length12: false,
        length16: false,
        hasLower: false,
        hasUpper: false,
        hasNumber: false,
        hasSymbol: false,
        bonusAllTypes: false,
        noCommonPatterns: true,
        noRepeatedChars: true,
      },
      deductions: [],
      strengths: [],
    };
  }

  const length = password.length;

  // 1. 길이 점수 계산 (최대 50점)
  // - 8자 이상 (+20점), 12자 이상 (+20점), 16자 이상 (+10점)
  const length8 = length >= 8;
  const length12 = length >= 12;
  const length16 = length >= 16;

  let lengthScore = 0;
  if (length8) lengthScore += 20;
  if (length12) lengthScore += 20;
  if (length16) lengthScore += 10;

  // 2. 문자 조합 점수 계산 (각 10점, 최대 40점)
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^a-zA-Z0-9]/.test(password);

  let varietyScore = 0;
  if (hasLower) varietyScore += 10;
  if (hasUpper) varietyScore += 10;
  if (hasNumber) varietyScore += 10;
  if (hasSymbol) varietyScore += 10;

  // 3. 보너스 점수 (최대 10점)
  // - 12자 이상이면서 4종 모두 포함 시 +10점
  const bonusAllTypes = length12 && hasLower && hasUpper && hasNumber && hasSymbol;
  const bonusScore = bonusAllTypes ? 10 : 0;

  // 4. 감점 요인 계산
  // - 흔한 패턴 포함 시 -30점
  // - 동일 문자 3회 이상 연속 반복 시 -20점
  const deductions = [];
  let deductionScore = 0;

  const foundCommonPattern = COMMON_PATTERNS.some((pattern) => pattern.test(password));
  const noCommonPatterns = !foundCommonPattern;
  if (foundCommonPattern) {
    deductionScore += 30;
    deductions.push('흔한 취약 패턴(1234, qwer, password 등) 포함 (-30점)');
  }

  const foundRepeatedChars = REPEATED_CHARS.test(password);
  const noRepeatedChars = !foundRepeatedChars;
  if (foundRepeatedChars) {
    deductionScore += 20;
    deductions.push('동일 문자 3회 이상 연속 반복(aaa, 111 등) 포함 (-20점)');
  }

  // 총점 계산 (최저 0점, 최고 100점)
  const rawScore = lengthScore + varietyScore + bonusScore - deductionScore;
  const score = Math.max(0, Math.min(100, rawScore));

  // 4단계 등급 판정 (위험 / 취약 / 보통 / 안전)
  let level = 'danger';
  let label = '위험';
  let color = 'danger';

  if (score >= 80) {
    level = 'secure';
    label = '안전';
    color = 'secure';
  } else if (score >= 60) {
    level = 'moderate';
    label = '보통';
    color = 'moderate';
  } else if (score >= 40) {
    level = 'weak';
    label = '취약';
    color = 'weak';
  } else {
    level = 'danger';
    label = '위험';
    color = 'danger';
  }

  return {
    score,
    level,
    label,
    color,
    checks: {
      length8,
      length12,
      length16,
      hasLower,
      hasUpper,
      hasNumber,
      hasSymbol,
      bonusAllTypes,
      noCommonPatterns,
      noRepeatedChars,
    },
    deductions,
  };
}
