/**
 * Login page component for beomseo.in website.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn, AlertCircle } from 'lucide-react';
import './LoginPage.css';

function LoginPage() {
    const navigate = useNavigate();
    const { login, error, clearError } = useAuth();
    const [nickname, setNickname] = useState('');
    const [password, setPassword] = useState('');
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

        if (!password) {
            setLocalError('비밀번호를 입력해주세요.');
            return;
        }

        setLoading(true);
        const result = await login(nickname, password);
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
                    <h1>beomseo.in</h1>
                    <p>로그인</p>
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
                            placeholder="닉네임을 입력하세요"
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
                            placeholder="비밀번호를 입력하세요"
                            disabled={loading}
                            autoComplete="current-password"
                        />
                    </div>

                    <button type="submit" className="login-button" disabled={loading}>
                        {loading ? (
                            <span>로그인 중...</span>
                        ) : (
                            <>
                                <LogIn size={18} />
                                <span>로그인</span>
                            </>
                        )}
                    </button>
                </form>

                <div className="login-footer">
                    <p>
                        계정이 없으신가요?{' '}
                        <Link to="/signup">회원가입</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}

export default LoginPage;
