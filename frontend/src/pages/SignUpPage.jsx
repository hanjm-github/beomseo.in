/**
 * Sign Up page component for 범서고등학교 website.
 * Registration is IP-restricted to Ulsan Education Office network.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserPlus, AlertCircle, Info } from 'lucide-react';
import './LoginPage.css';

function SignUpPage() {
    const navigate = useNavigate();
    const { register, error, clearError } = useAuth();
    const [nickname, setNickname] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [localError, setLocalError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLocalError('');
        clearError();

        if (!nickname.trim()) {
            setLocalError('닉네임을 입력해주세요.');
            return;
        }

        if (nickname.length < 2 || nickname.length > 50) {
            setLocalError('닉네임은 2-50자 사이로 입력해주세요.');
            return;
        }

        if (!password) {
            setLocalError('비밀번호를 입력해주세요.');
            return;
        }

        if (password.length < 8) {
            setLocalError('비밀번호는 최소 8자 이상이어야 합니다.');
            return;
        }

        if (password !== confirmPassword) {
            setLocalError('비밀번호가 일치하지 않습니다.');
            return;
        }

        setLoading(true);
        const result = await register(nickname, password);
        setLoading(false);

        if (result.success) {
            navigate('/');
        }
    };

    const displayError = localError || error;

    return (
        <div className="login-page">
            <div className="login-container">
                <div className="login-header">
                    <h1>범서고등학교</h1>
                    <p>회원가입</p>
                </div>

                <div className="ip-notice">
                    <Info size={18} />
                    <span>회원가입은 울산광역시교육청 네트워크에서만 가능합니다.</span>
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
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">비밀번호</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="비밀번호 (8자 이상)"
                            disabled={loading}
                            autoComplete="new-password"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirmPassword">비밀번호 확인</label>
                        <input
                            type="password"
                            id="confirmPassword"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="비밀번호를 다시 입력하세요"
                            disabled={loading}
                            autoComplete="new-password"
                        />
                    </div>

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
                        <Link to="/login">로그인</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}

export default SignUpPage;
