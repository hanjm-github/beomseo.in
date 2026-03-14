/**
 * @file src/pages/SignUpPage.jsx
 * @description Implements route-level views and page orchestration logic.
 * Responsibilities:
 * - Coordinate route state, fetch lifecycles, and permission-driven page behavior.
 * Key dependencies:
 * - react
 * - react-router-dom
 * - ../context/AuthContext
 * - lucide-react
 * Side effects:
 * - Influences client-side routing and navigation state.
 * Role in app flow:
 * - Owns route-level user flows and composes feature components.
 */
/**
 * Sign Up page component for beomseo.in website.
 */
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserPlus, AlertCircle, Info, Eye, EyeOff } from 'lucide-react';
import { APP_NAME } from '../config/env';
import { resolveAuthRedirectTarget } from '../utils/authRedirect';
import './LoginPage.css';

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 72;

function getPasswordChecks(password) {
    return {
        length: password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH,
        lowercase: /[a-z]/.test(password),
        number: /[0-9]/.test(password),
        special: /[^A-Za-z0-9]/.test(password),
    };
}

function SignUpPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const { register, error, clearError } = useAuth();
    const [nickname, setNickname] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [localError, setLocalError] = useState('');
    const trimmedNickname = nickname.trim();
    const redirectTarget = resolveAuthRedirectTarget(location.state?.from);
    const authEntryState = location.state?.from ? { from: location.state.from } : undefined;
    const passwordChecks = getPasswordChecks(password);
    const isPasswordStrong = Object.values(passwordChecks).every(Boolean);
    const isPasswordMatch = password.length > 0 && password === confirmPassword;

    const passwordRuleItems = [
        {
            key: 'length',
            label: `${PASSWORD_MIN_LENGTH}~${PASSWORD_MAX_LENGTH}자`,
            valid: passwordChecks.length,
        },
        {
            key: 'lowercase',
            label: '소문자 1개 이상',
            valid: passwordChecks.lowercase,
        },
        {
            key: 'number',
            label: '숫자 1개 이상',
            valid: passwordChecks.number,
        },
        {
            key: 'special',
            label: '특수문자 1개 이상',
            valid: passwordChecks.special,
        },
    ];

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLocalError('');
        clearError();

        if (!trimmedNickname) {
            setLocalError('닉네임을 입력해주세요.');
            return;
        }

        if (trimmedNickname.length < 2 || trimmedNickname.length > 50) {
            setLocalError('닉네임은 2-50자 사이로 입력해주세요.');
            return;
        }

        if (!password) {
            setLocalError('비밀번호를 입력해주세요.');
            return;
        }

        if (!isPasswordStrong) {
            setLocalError(
                `비밀번호는 ${PASSWORD_MIN_LENGTH}~${PASSWORD_MAX_LENGTH}자이며 소문자/숫자/특수문자를 각각 1개 이상 포함해야 합니다.`
            );
            return;
        }

        if (password !== confirmPassword) {
            setLocalError('비밀번호가 일치하지 않습니다.');
            return;
        }

        setLoading(true);
        const result = await register(trimmedNickname, password);
        setLoading(false);

        if (result.success) {
            navigate(redirectTarget, { replace: true });
        }
    };

    const displayError = localError || error;

    return (
        <div className="login-page">
            <div className="login-container">
                <div className="login-header">
                    <img src="/mit_logo.png" alt={`${APP_NAME} 로고`} className="auth-logo" width="72" height="72" />
                    <h1>{APP_NAME}</h1>
                    <p>회원가입</p>
                </div>

                <div className="ip-notice">
                    <Info size={18} />
                    <span>회원가입은 범서고등학교 교내 와이파이에서만 가능합니다.</span>
                </div>

                <form className="login-form" onSubmit={handleSubmit}>
                    {displayError && (
                        <div className="error-message">
                            <AlertCircle size={18} />
                            <span>{displayError}</span>
                        </div>
                    )}

                    <div className="form-group">
                        <label htmlFor="nickname">닉네임</label>
                        <input
                            type="text"
                            id="nickname"
                            value={nickname}
                            onChange={(e) => setNickname(e.target.value)}
                            placeholder="닉네임을 입력하세요 (2-50자)"
                            disabled={loading}
                            autoComplete="username"
                            maxLength={50}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">비밀번호</label>
                        <div className="password-input-wrapper">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={`비밀번호 (${PASSWORD_MIN_LENGTH}~${PASSWORD_MAX_LENGTH}자)`}
                                disabled={loading}
                                autoComplete="new-password"
                                aria-describedby="password-rule-guide"
                                minLength={PASSWORD_MIN_LENGTH}
                                maxLength={PASSWORD_MAX_LENGTH}
                            />
                            <button
                                type="button"
                                className="password-visibility-toggle"
                                onClick={() => setShowPassword((prev) => !prev)}
                                disabled={loading}
                                aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'}
                            >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                <span>{showPassword ? '숨기기' : '보기'}</span>
                            </button>
                        </div>
                        <div className="password-rule-guide" id="password-rule-guide" aria-live="polite">
                            <p>비밀번호 규정</p>
                            <ul className="password-rule-list">
                                {passwordRuleItems.map((rule) => (
                                    <li
                                        key={rule.key}
                                        className={`password-rule-item ${rule.valid ? 'is-valid' : ''}`}
                                    >
                                        <span className="password-rule-icon" aria-hidden="true">
                                            {rule.valid ? '✓' : '•'}
                                        </span>
                                        <span>{rule.label}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirmPassword">비밀번호 확인</label>
                        <div className="password-input-wrapper">
                            <input
                                type={showConfirmPassword ? 'text' : 'password'}
                                id="confirmPassword"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="비밀번호를 다시 입력하세요"
                                disabled={loading}
                                autoComplete="new-password"
                                minLength={PASSWORD_MIN_LENGTH}
                                maxLength={PASSWORD_MAX_LENGTH}
                            />
                            <button
                                type="button"
                                className="password-visibility-toggle"
                                onClick={() => setShowConfirmPassword((prev) => !prev)}
                                disabled={loading}
                                aria-label={showConfirmPassword ? '비밀번호 확인 숨기기' : '비밀번호 확인 표시'}
                            >
                                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                <span>{showConfirmPassword ? '숨기기' : '보기'}</span>
                            </button>
                        </div>
                        {confirmPassword && (
                            <p className={`field-help ${isPasswordMatch ? 'is-valid' : 'is-invalid'}`}>
                                {isPasswordMatch ? '비밀번호가 일치합니다.' : '비밀번호가 일치하지 않습니다.'}
                            </p>
                        )}
                    </div>

                    <p className="signup-consent">
                        회원가입 시{' '}
                        <Link to="/privacy" target="_blank">개인정보처리방침</Link>
                        {' '}및{' '}
                        <Link to="/terms" target="_blank">이용약관</Link>
                        에 동의하는 것으로 간주됩니다.
                    </p>

                    <button type="submit" className="login-button" disabled={loading}>
                        {loading ? (
                            <span>가입 중...</span>
                        ) : (
                            <>
                                <UserPlus size={18} />
                                <span>회원가입</span>
                            </>
                        )}
                    </button>
                </form>

                <div className="login-footer">
                    <p>
                        이미 계정이 있으신가요?{' '}
                        <Link to="/login" state={authEntryState}>로그인</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}

export default SignUpPage;

