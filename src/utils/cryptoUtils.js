/**
 * Web Crypto API 기반 보안 암호학 유틸리티
 * 1. window.crypto.getRandomValues()를 사용한 안전한 비밀번호 생성
 * 2. k-익명성 + Add-Padding 기반 HIBP 유출 여부 확인
 */

const CHARSETS = {
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
};

/**
 * 모듈로 편향(modulo bias) 없는 암호학적 안전 무작위 정수 생성 (0 <= value < max)
 * @param {number} max 
 * @returns {number}
 */
function getSecureRandomInt(max) {
  if (max <= 0) return 0;
  const maxValid = 256 - (256 % max);
  const buffer = new Uint8Array(1);
  while (true) {
    window.crypto.getRandomValues(buffer);
    if (buffer[0] < maxValid) {
      return buffer[0] % max;
    }
  }
}

/**
 * 안전한 비밀번호 생성기
 * Math.random()은 절대 사용하지 않고 window.crypto.getRandomValues()만 사용합니다.
 * @param {object} options
 * @param {number} options.length - 비밀번호 길이 (8~32)
 * @param {boolean} options.uppercase - 대문자 포함 여부
 * @param {boolean} options.lowercase - 소문자 포함 여부
 * @param {boolean} options.numbers - 숫자 포함 여부
 * @param {boolean} options.symbols - 특수문자 포함 여부
 * @returns {string} 생성된 비밀번호
 */
export function generateSecurePassword({
  length = 16,
  uppercase = true,
  lowercase = true,
  numbers = true,
  symbols = true,
}) {
  const chosenCategories = [];
  if (uppercase) chosenCategories.push(CHARSETS.uppercase);
  if (lowercase) chosenCategories.push(CHARSETS.lowercase);
  if (numbers) chosenCategories.push(CHARSETS.numbers);
  if (symbols) chosenCategories.push(CHARSETS.symbols);

  // 최소 1개 이상의 문자 종류가 선택되어야 함
  if (chosenCategories.length === 0) {
    throw new Error('최소 1개 이상의 문자 종류를 선택해야 합니다.');
  }

  const effectiveLength = Math.max(8, Math.min(32, length));
  const passwordChars = [];

  // 선택된 각 카테고리에서 최소 1글자씩 먼저 보장 추출
  for (const charset of chosenCategories) {
    const idx = getSecureRandomInt(charset.length);
    passwordChars.push(charset[idx]);
  }

  // 전체 선택 문자 풀 구성
  const fullCharset = chosenCategories.join('');

  // 나머지 길이만큼 균등 무작위 추출
  while (passwordChars.length < effectiveLength) {
    const idx = getSecureRandomInt(fullCharset.length);
    passwordChars.push(fullCharset[idx]);
  }

  // 피셔-예이츠 셔플(Fisher-Yates)로 생성된 문자 배열을 무작위로 섞음 (편향 방지)
  for (let i = passwordChars.length - 1; i > 0; i--) {
    const j = getSecureRandomInt(i + 1);
    const temp = passwordChars[i];
    passwordChars[i] = passwordChars[j];
    passwordChars[j] = temp;
  }

  return passwordChars.join('');
}

/**
 * 문자열의 SHA-1 해시를 계산하여 대문자 16진수 문자열로 반환
 * @param {string} text 
 * @returns {Promise<string>} 40자리 대문자 SHA-1 해시
 */
export async function computeSha1Hex(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await window.crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/**
 * HIBP(Have I Been Pwned) Range API를 사용해 k-익명성 기반 유출 여부 확인
 * - 비밀번호 원문은 서버로 전송되지 않음
 * - SHA-1 해시의 앞 5글자(prefix)만 전송
 * - Add-Padding: true 헤더로 패딩 적용 (유출 횟수 0 가짜 항목은 필터링)
 * - 브라우저 로컬에서 대문자 suffix 대조
 * 
 * @param {string} password 
 * @returns {Promise<{prefix: string, isPwned: boolean, count: number}>}
 */
export async function checkPwnedPassword(password) {
  if (!password) {
    throw new Error('비밀번호를 입력해 주세요.');
  }

  // 1. SHA-1 해시 계산 및 대문자 변환
  const fullHash = await computeSha1Hex(password);

  // 2. 앞 5자리(prefix)와 뒤 35자리(suffix) 분리
  const prefix = fullHash.slice(0, 5);
  const suffix = fullHash.slice(5);

  // 3. HIBP Range API 호출 (Add-Padding 헤더 적용)
  const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
    method: 'GET',
    headers: {
      'Add-Padding': 'true',
    },
  });

  if (!response.ok) {
    throw new Error(`HIBP 서버 응답 실패 (${response.status})`);
  }

  const responseText = await response.text();
  const lines = responseText.split(/\r?\n/);

  let isPwned = false;
  let count = 0;

  // 4. 응답 파싱 및 대조 (유출횟수 0인 가짜 항목 제외)
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const parts = trimmed.split(':');
    if (parts.length < 2) continue;

    const lineSuffix = parts[0].trim().toUpperCase();
    const pwnedCount = parseInt(parts[1].trim(), 10);

    // Add-Padding으로 삽입된 유출 횟수 0인 더미 데이터는 제외
    if (isNaN(pwnedCount) || pwnedCount === 0) {
      continue;
    }

    if (lineSuffix === suffix) {
      isPwned = true;
      count = pwnedCount;
      break;
    }
  }

  // 보안 원칙: 비밀번호 원문이나 전체 해시는 반환하거나 출력하지 않고
  // 오직 앞 5글자 접두사와 유출 여부/횟수만 반환합니다.
  return {
    prefix,
    isPwned,
    count,
  };
}
