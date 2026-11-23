import { useState, useRef, useId, useEffect } from 'react';
import { evaluatePasswordStrength } from './utils/strengthUtils';
import { generateSecurePassword, checkPwnedPassword } from './utils/cryptoUtils';
import './App.css';

export default function App() {
  const passwordInputId = useId();
  const lengthSliderId = useId();
  const upperCheckId = useId();
  const lowerCheckId = useId();
  const numbersCheckId = useId();
  const symbolsCheckId = useId();

  // 테마 관리 (다크 / 라이트 모드)
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('theme_preference');
      if (saved === 'light' || saved === 'dark') return saved;
      return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('theme_preference', theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // 섹션 1: 비밀번호 강도 & 유출 확인 상태
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pwnedState, setPwnedState] = useState({
    loading: false,
    checked: false,
    isPwned: false,
    count: 0,
    prefix: '',
    error: null,
  });

  // 섹션 2: 안전한 비밀번호 생성기 상태
  const [genLength, setGenLength] = useState(16);
  const [charTypes, setCharTypes] = useState({
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true,
  });
  // 초기 렌더링 시 암호학적으로 안전한 기본 비밀번호 생성 (lazy initialization)
  const [generatedPassword, setGeneratedPassword] = useState(() => {
    try {
      return generateSecurePassword({
        length: 16,
        uppercase: true,
        lowercase: true,
        numbers: true,
        symbols: true,
      });
    } catch {
      return '';
    }
  });
  const [copied, setCopied] = useState(false);
  const [transferNotice, setTransferNotice] = useState(false);

  const passwordInputRef = useRef(null);

  // 실시간 강도 평가 (메모리 내 순수 로컬 계산)
  const strength = evaluatePasswordStrength(password);

  // 비밀번호 입력 변경 핸들러
  const handlePasswordChange = (e) => {
    const val = e.target.value;
    setPassword(val);
    // 입력이 변경되면 이전 유출 조회 결과는 초기화
    if (pwnedState.checked || pwnedState.error) {
      setPwnedState({
        loading: false,
        checked: false,
        isPwned: false,
        count: 0,
        prefix: '',
        error: null,
      });
    }
  };

  // HIBP 유출 여부 확인 버튼 클릭 핸들러
  const handleCheckPwned = async () => {
    if (!password) {
      alert('유출 여부를 확인할 비밀번호를 먼저 입력해 주세요.');
      if (passwordInputRef.current) passwordInputRef.current.focus();
      return;
    }

    setPwnedState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const result = await checkPwnedPassword(password);
      setPwnedState({
        loading: false,
        checked: true,
        isPwned: result.isPwned,
        count: result.count,
        prefix: result.prefix,
        error: null,
      });
    } catch (err) {
      setPwnedState({
        loading: false,
        checked: false,
        isPwned: false,
        count: 0,
        prefix: '',
        error: err.message || '유출 확인 조회 중 오류가 발생했습니다.',
      });
    }
  };

  // 생성기 체크박스 토글 핸들러 (최소 1개 선택 필수 유지)
  const handleCharTypeToggle = (type) => {
    setCharTypes((prev) => {
      const currentSelectedCount = Object.values(prev).filter(Boolean).length;
      if (prev[type] && currentSelectedCount <= 1) {
        alert('최소 1개 이상의 문자 종류를 선택해야 합니다.');
        return prev;
      }
      return {
        ...prev,
        [type]: !prev[type],
      };
    });
  };

  // 신규 비밀번호 생성 핸들러
  const handleGenerate = () => {
    try {
      const newPw = generateSecurePassword({
        length: genLength,
        uppercase: charTypes.uppercase,
        lowercase: charTypes.lowercase,
        numbers: charTypes.numbers,
        symbols: charTypes.symbols,
      });
      setGeneratedPassword(newPw);
      setCopied(false);
      setTransferNotice(false);
    } catch (err) {
      alert(err.message);
    }
  };

  // 클립보드 복사 핸들러
  const handleCopy = async () => {
    if (!generatedPassword) return;
    try {
      await navigator.clipboard.writeText(generatedPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // 대체 복사 방식
      const textarea = document.createElement('textarea');
      textarea.value = generatedPassword;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  // 위 입력창에 바로 넣기 핸들러
  const handleApplyToInput = () => {
    if (!generatedPassword) return;
    setPassword(generatedPassword);
    setPwnedState({
      loading: false,
      checked: false,
      isPwned: false,
      count: 0,
      prefix: '',
      error: null,
    });
    setTransferNotice(true);
    setTimeout(() => setTransferNotice(false), 3000);

    if (passwordInputRef.current) {
      passwordInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      passwordInputRef.current.focus();
    }
  };

  // 게이지 색상 클래스
  const getGaugeClass = () => {
    if (!password) return 'gauge-empty';
    if (strength.level === 'secure') return 'gauge-secure';
    if (strength.level === 'moderate') return 'gauge-moderate';
    if (strength.level === 'weak') return 'gauge-weak';
    return 'gauge-danger';
  };

  return (
    <div className="app-container">
      {/* 상단 테마 토글 네비게이션 */}
      <div className="top-nav">
        <button
          type="button"
          className="theme-toggle-btn"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
        >
          {theme === 'dark' ? (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
              <span>라이트 모드</span>
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
              <span>다크 모드</span>
            </>
          )}
        </button>
      </div>

      {/* 상단 헤더 */}
      <header className="app-header">
        <div className="header-badge">
          <svg className="shield-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          Zero-Knowledge Security
        </div>
        <h1 className="header-title">비밀번호 보안 도구</h1>
        <p className="header-principles">
          <span className="principle-tag">로컬 강도 분석</span>
          <span className="principle-dot">·</span>
          <span className="principle-tag">k-익명성 유출 조회</span>
        </p>
        <div className="security-notice-banner">
          <svg className="info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <span>
            비밀번호 원문은 브라우저 메모리에만 존재하며 서버에 전송되거나 저장되지 않습니다.
          </span>
        </div>
      </header>

      <main className="main-content">
        {/* ========================================================= */}
        {/* 섹션 1 [비밀번호 강도 & 유출 확인] */}
        {/* ========================================================= */}
        <section className="tool-card" id="strength-section">
          <div className="card-header">
            <div className="card-title-group">
              <span className="section-number">SECTION 1</span>
              <h2 className="card-title">비밀번호 강도 & 유출 확인</h2>
            </div>
            <span className="card-badge">실시간 로컬 분석</span>
          </div>

          {/* 비밀번호 입력창 */}
          <div className="input-group">
            <label className="input-label" htmlFor={passwordInputId}>
              점검할 비밀번호
            </label>
            <div className="input-field-wrapper">
              <input
                id={passwordInputId}
                ref={passwordInputRef}
                type={showPassword ? 'text' : 'password'}
                className="password-input"
                placeholder="비밀번호를 입력하여 강도와 유출을 확인하세요"
                value={password}
                onChange={handlePasswordChange}
                autoComplete="off"
                spellCheck="false"
              />
              <button
                type="button"
                className="toggle-visibility-btn"
                onClick={() => setShowPassword((prev) => !prev)}
                title={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            {password.length > 0 && (
              <div className="char-count-info">
                현재 길이: <strong>{password.length}</strong>자
              </div>
            )}
          </div>

          {/* 실시간 강도 게이지 */}
          <div className="strength-display">
            <div className="strength-header">
              <div className="strength-level-tag">
                상태:{' '}
                <span className={`level-pill pill-${strength.color}`}>
                  {password ? strength.label : '대기 중'}
                </span>
              </div>
              <div className="strength-score">
                점수: <strong>{strength.score}</strong> / 100점
              </div>
            </div>

            <div className="gauge-track">
              <div
                className={`gauge-fill ${getGaugeClass()}`}
                style={{ width: `${password ? Math.max(5, strength.score) : 0}%` }}
              />
            </div>
          </div>

          {/* 충족/부족 조건 체크리스트 */}
          <div className="checklist-container">
            <h3 className="checklist-heading">강도 기준 체크리스트</h3>
            <div className="checklist-grid">
              <div className={`check-item ${strength.checks.length8 ? 'valid' : 'invalid'}`}>
                <span className="check-icon">{strength.checks.length8 ? '✓' : '✕'}</span>
                <span>8자 이상 (+20점)</span>
              </div>
              <div className={`check-item ${strength.checks.length12 ? 'valid' : 'invalid'}`}>
                <span className="check-icon">{strength.checks.length12 ? '✓' : '✕'}</span>
                <span>12자 이상 (+20점)</span>
              </div>
              <div className={`check-item ${strength.checks.length16 ? 'valid' : 'invalid'}`}>
                <span className="check-icon">{strength.checks.length16 ? '✓' : '✕'}</span>
                <span>16자 이상 (+10점)</span>
              </div>
              <div className={`check-item ${strength.checks.hasLower ? 'valid' : 'invalid'}`}>
                <span className="check-icon">{strength.checks.hasLower ? '✓' : '✕'}</span>
                <span>소문자 포함 (+10점)</span>
              </div>
              <div className={`check-item ${strength.checks.hasUpper ? 'valid' : 'invalid'}`}>
                <span className="check-icon">{strength.checks.hasUpper ? '✓' : '✕'}</span>
                <span>대문자 포함 (+10점)</span>
              </div>
              <div className={`check-item ${strength.checks.hasNumber ? 'valid' : 'invalid'}`}>
                <span className="check-icon">{strength.checks.hasNumber ? '✓' : '✕'}</span>
                <span>숫자 포함 (+10점)</span>
              </div>
              <div className={`check-item ${strength.checks.hasSymbol ? 'valid' : 'invalid'}`}>
                <span className="check-icon">{strength.checks.hasSymbol ? '✓' : '✕'}</span>
                <span>특수문자 포함 (+10점)</span>
              </div>
              <div className={`check-item ${strength.checks.bonusAllTypes ? 'valid' : 'invalid'}`}>
                <span className="check-icon">{strength.checks.bonusAllTypes ? '✓' : '✕'}</span>
                <span>12자 이상 + 4종 모두 조합 (보너스 +10점)</span>
              </div>
              <div className={`check-item ${strength.checks.noCommonPatterns ? 'valid' : 'penalty'}`}>
                <span className="check-icon">{strength.checks.noCommonPatterns ? '✓' : '⚠'}</span>
                <span>흔한 패턴 미포함 (위반 시 -30점)</span>
              </div>
              <div className={`check-item ${strength.checks.noRepeatedChars ? 'valid' : 'penalty'}`}>
                <span className="check-icon">{strength.checks.noRepeatedChars ? '✓' : '⚠'}</span>
                <span>동일 문자 3회 반복 없음 (위반 시 -20점)</span>
              </div>
            </div>

            {strength.deductions.length > 0 && (
              <div className="deductions-warning">
                {strength.deductions.map((msg, i) => (
                  <div key={i} className="deduction-row">
                    <span className="warning-dot">●</span> {msg}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 유출 여부 확인 버튼 및 결과 영역 */}
          <div className="pwned-check-section">
            <div className="pwned-action-bar">
              <button
                type="button"
                className="pwned-btn"
                onClick={handleCheckPwned}
                disabled={pwnedState.loading || !password}
              >
                {pwnedState.loading ? (
                  <>
                    <span className="spinner" />
                    <span>k-익명성 조회 중...</span>
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 2l-2 2m-1-1l-3 3m5 0l-3-3m-3 3l-2 2M3 11v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <span>유출 여부 확인 (HIBP k-익명성)</span>
                  </>
                )}
              </button>
              <span className="pwned-hint">
                * [확인] 클릭 시에만 전송되며, SHA-1 앞 5자리만 전송됩니다.
              </span>
            </div>

            {/* 오류 메시지 */}
            {pwnedState.error && (
              <div className="result-card result-error">
                <div className="result-header">
                  <span className="result-badge-error">조회 오류</span>
                </div>
                <p className="result-text">{pwnedState.error}</p>
              </div>
            )}

            {/* 유출 확인 결과 카드 */}
            {pwnedState.checked && (
              <div
                className={`result-card ${
                  pwnedState.isPwned ? 'result-danger' : 'result-secure'
                }`}
              >
                <div className="result-header">
                  <div className="result-status-title">
                    {pwnedState.isPwned ? (
                      <>
                        <span className="result-icon-danger">⚠️</span>
                        <span>유출 경고: 해킹 사고 유출 이력이 확인되었습니다!</span>
                      </>
                    ) : (
                      <>
                        <span className="result-icon-secure">🛡️</span>
                        <span>유출 이력 없음: 안전한 비밀번호입니다!</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="result-content">
                  {pwnedState.isPwned ? (
                    <div className="pwned-count-box">
                      이 비밀번호는 알려진 데이터 유출 사고에서 총{' '}
                      <strong className="danger-highlight">
                        {pwnedState.count.toLocaleString()}회
                      </strong>{' '}
                      발견되었습니다. 다른 서비스에 이미 노출되었을 가능성이 매우 높으므로 실제 서비스에 절대 사용하지 마세요.
                    </div>
                  ) : (
                    <div className="secure-desc-box">
                      수억 건의 공개 데이터 유출 내역(HIBP) 데이터베이스에서 해당 비밀번호가 발견되지 않았습니다. 안심하고 사용하셔도 좋습니다.
                    </div>
                  )}

                  <div className="k-anonymity-proof">
                    <span className="proof-label">전송된 해시 접두사:</span>{' '}
                    <code className="proof-code">{pwnedState.prefix}</code>
                    <span className="proof-desc">
                      (40자리 SHA-1 해시 중 앞 5글자만 서버로 전송되었으며, 대조는 브라우저 내부에서 완료되었습니다.)
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ========================================================= */}
        {/* 섹션 2 [안전한 비밀번호 생성기] */}
        {/* ========================================================= */}
        <section className="tool-card" id="generator-section">
          <div className="card-header">
            <div className="card-title-group">
              <span className="section-number">SECTION 2</span>
              <h2 className="card-title">안전한 비밀번호 생성기</h2>
            </div>
            <span className="card-badge badge-crypto">crypto.getRandomValues()</span>
          </div>

          <div className="generator-controls">
            {/* 길이 슬라이더 */}
            <div className="control-row">
              <div className="slider-header">
                <label className="control-label" htmlFor={lengthSliderId}>
                  비밀번호 길이
                </label>
                <span className="slider-value-pill">{genLength}자</span>
              </div>
              <input
                id={lengthSliderId}
                type="range"
                min="8"
                max="32"
                value={genLength}
                onChange={(e) => setGenLength(Number(e.target.value))}
                className="length-slider"
              />
              <div className="slider-ticks">
                <span>8자 (최소)</span>
                <span>16자 (권장)</span>
                <span>24자</span>
                <span>32자 (최대)</span>
              </div>
            </div>

            {/* 문자 종류 체크박스 */}
            <div className="control-row">
              <span className="control-label">문자 종류 선택 (최소 1개)</span>
              <div className="checkbox-grid">
                <label className="checkbox-label" htmlFor={upperCheckId}>
                  <input
                    id={upperCheckId}
                    type="checkbox"
                    checked={charTypes.uppercase}
                    onChange={() => handleCharTypeToggle('uppercase')}
                  />
                  <span>대문자 (A-Z)</span>
                </label>
                <label className="checkbox-label" htmlFor={lowerCheckId}>
                  <input
                    id={lowerCheckId}
                    type="checkbox"
                    checked={charTypes.lowercase}
                    onChange={() => handleCharTypeToggle('lowercase')}
                  />
                  <span>소문자 (a-z)</span>
                </label>
                <label className="checkbox-label" htmlFor={numbersCheckId}>
                  <input
                    id={numbersCheckId}
                    type="checkbox"
                    checked={charTypes.numbers}
                    onChange={() => handleCharTypeToggle('numbers')}
                  />
                  <span>숫자 (0-9)</span>
                </label>
                <label className="checkbox-label" htmlFor={symbolsCheckId}>
                  <input
                    id={symbolsCheckId}
                    type="checkbox"
                    checked={charTypes.symbols}
                    onChange={() => handleCharTypeToggle('symbols')}
                  />
                  <span>특수문자 (!@#$...)</span>
                </label>
              </div>
            </div>
          </div>

          {/* 생성 버튼 및 출력창 */}
          <div className="generator-output-container">
            <div className="generated-password-box">
              <span className="generated-pw-text">{generatedPassword || '생성 버튼을 누르세요'}</span>
            </div>

            <div className="generator-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleGenerate}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 4v6h-6" />
                  <path d="M1 20v-6h6" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
                <span>새로 생성하기</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCopy}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                <span>{copied ? '복사 완료!' : '클립보드 복사'}</span>
              </button>

              <button
                type="button"
                className="btn btn-accent"
                onClick={handleApplyToInput}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="5 12 12 5 19 12" />
                </svg>
                <span>위 입력창에 바로 넣기</span>
              </button>
            </div>

            {transferNotice && (
              <div className="transfer-notice">
                ✓ 생성된 비밀번호가 섹션 1 입력창에 적용되었습니다. 바로 강도 및 유출을 확인해 보세요!
              </div>
            )}
          </div>
        </section>
      </main>

      {/* 푸터 */}
      <footer className="app-footer">
        <p className="footer-title">
          보안 원칙: 최소 전송 원칙(k-Anonymity) & 로컬 무전송 강도 분석
        </p>
        <p className="footer-sub">
          26-w12-password · Web Crypto API (SubtleCrypto & getRandomValues)
        </p>
      </footer>
    </div>
  );
}
