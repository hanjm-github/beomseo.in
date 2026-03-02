"""
Authentication routes for signup, login, and token management.
"""
import re
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import (
    jwt_required,
    get_jwt,
    set_access_cookies,
    set_refresh_cookies,
    unset_jwt_cookies,
)

from models.user import db, User, UserRole
from utils.security import (
    hash_password,
    verify_password,
    get_client_ip,
    is_ip_allowed,
    get_current_user,
    sanitize_plain_text,
    parse_jwt_identity_to_int,
)
from utils.security_tokens import (
    issue_token_pair,
    rotate_refresh_token_pair,
    revoke_token_jti,
    revoke_raw_refresh_token,
)
from utils.rate_limit import limiter

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 72
NICKNAME_MIN_LENGTH = 2
NICKNAME_MAX_LENGTH = 50
TOKEN_ISSUING_ENDPOINTS = {'auth.register', 'auth.login', 'auth.refresh'}


def _uses_cookie_transport() -> bool:
    locations = [str(location).strip().lower() for location in current_app.config.get('JWT_TOKEN_LOCATION', [])]
    return 'cookies' in locations


def _build_auth_response(message, user_dict, access_token, refresh_token, status_code):
    payload = {
        'message': message,
        'user': user_dict,
    }

    response = jsonify(payload)
    if _uses_cookie_transport():
        set_access_cookies(response, access_token)
        set_refresh_cookies(response, refresh_token)
    return response, status_code


def _build_refresh_response(access_token, refresh_token):
    response = jsonify({'message': '토큰이 갱신되었습니다.'})
    if _uses_cookie_transport():
        set_access_cookies(response, access_token)
        set_refresh_cookies(response, refresh_token)
    return response, 200


@auth_bp.after_request
def _set_no_store_headers(response):
    """Disable intermediary/browser caching on token-issuing endpoints."""
    if request.endpoint in TOKEN_ISSUING_ENDPOINTS:
        response.headers['Cache-Control'] = 'no-store'
        response.headers['Pragma'] = 'no-cache'
    return response


def _password_is_strong(password: str) -> bool:
    """Validate password policy used during registration."""
    if len(password) < PASSWORD_MIN_LENGTH or len(password) > PASSWORD_MAX_LENGTH:
        return False
    if not re.search(r'[a-z]', password):
        return False
    if not re.search(r'[0-9]', password):
        return False
    if not re.search(r'[^A-Za-z0-9]', password):
        return False
    return True


def find_banned_word_in_nickname(nickname, banned_words):
    """Return first banned word found in nickname, case-insensitive."""
    normalized_nickname = nickname.casefold()
    for word in banned_words or []:
        candidate = str(word).strip()
        if not candidate:
            continue
        if candidate.casefold() in normalized_nickname:
            return candidate
    return None


@auth_bp.route('/register', methods=['POST'])
@limiter.limit(lambda: current_app.config.get('RATELIMIT_REGISTER_LIMIT', '5 per 10 minute'))
def register():
    """
    Register a new user.
    IP-restricted to Ulsan Education Office network.
    """
    # Registration is intentionally network-restricted for school-only onboarding.
    client_ip = get_client_ip()
    allowed_ips = current_app.config.get('ALLOWED_SIGNUP_IPS', [])

    if not client_ip:
        return jsonify({'error': '클라이언트 IP를 확인할 수 없습니다.'}), 403
    if not is_ip_allowed(client_ip, allowed_ips):
        return jsonify({
            'error': '회원가입은 범서고등학교 교내 와이파이에서만 가능합니다.',
            'error_en': 'Registration is only allowed from Beomseo High School internal WiFi.'
        }), 403

    data = request.get_json(silent=True)

    # Body validation happens before DB access to keep error responses deterministic.
    if data is None:
        return jsonify({'error': 'Request body is required'}), 400
    if not isinstance(data, dict):
        return jsonify({'error': 'Request body must be a JSON object'}), 400

    nickname_raw = data.get('nickname', '')
    password_raw = data.get('password', '')
    if not isinstance(nickname_raw, str):
        return jsonify({'error': 'nickname must be a string'}), 422
    if not isinstance(password_raw, str):
        return jsonify({'error': 'password must be a string'}), 422

    nickname = sanitize_plain_text(nickname_raw, max_length=NICKNAME_MAX_LENGTH)
    password = password_raw

    if not nickname:
        return jsonify({'error': '닉네임을 입력해주세요.'}), 400

    if len(nickname) < NICKNAME_MIN_LENGTH or len(nickname) > NICKNAME_MAX_LENGTH:
        return jsonify({'error': f'닉네임은 {NICKNAME_MIN_LENGTH}-{NICKNAME_MAX_LENGTH}자 사이로 입력해주세요.'}), 400

    banned_word = find_banned_word_in_nickname(
        nickname,
        current_app.config.get('NICKNAME_BANNED_WORDS', []),
    )
    if banned_word:
        return jsonify({'error': '사용할 수 없는 닉네임입니다.'}), 400

    if not password:
        return jsonify({'error': '비밀번호를 입력해주세요.'}), 400

    if not _password_is_strong(password):
        return jsonify({
            'error': (
                f'비밀번호는 {PASSWORD_MIN_LENGTH}~{PASSWORD_MAX_LENGTH}자이며 '
                '소문자/숫자/특수문자를 각각 1개 이상 포함해야 합니다.'
            )
        }), 400
    
    # Nickname uniqueness is validated early for user-friendly conflicts.
    existing_user = User.query.filter_by(nickname=nickname).first()
    if existing_user:
        return jsonify({'error': '이미 사용 중인 닉네임입니다.'}), 409
    
    # Create new user with default student role
    user = User(
        nickname=nickname,
        password_hash=hash_password(password),
        role=UserRole.STUDENT
    )
    
    try:
        db.session.add(user)
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({'error': '회원가입 처리 중 오류가 발생했습니다.'}), 500

    try:
        access_token, refresh_token = issue_token_pair(user.id, user_role=user.role.value)
    except Exception:
        db.session.rollback()
        return jsonify({'error': '토큰 발급 중 오류가 발생했습니다.'}), 500
    
    return _build_auth_response(
        message='회원가입이 완료되었습니다.',
        user_dict=user.to_dict(),
        access_token=access_token,
        refresh_token=refresh_token,
        status_code=201,
    )


@auth_bp.route('/login', methods=['POST'])
@limiter.limit(lambda: current_app.config.get('RATELIMIT_LOGIN_LIMIT', '5 per minute'))
def login():
    """Authenticate user and issue fresh access/refresh token pair."""
    data = request.get_json(silent=True)

    if data is None:
        return jsonify({'error': 'Request body is required'}), 400
    if not isinstance(data, dict):
        return jsonify({'error': 'Request body must be a JSON object'}), 400

    nickname_raw = data.get('nickname', '')
    password_raw = data.get('password', '')
    if not isinstance(nickname_raw, str):
        return jsonify({'error': 'nickname must be a string'}), 422
    if not isinstance(password_raw, str):
        return jsonify({'error': 'password must be a string'}), 422

    nickname = sanitize_plain_text(nickname_raw, max_length=NICKNAME_MAX_LENGTH)
    password = password_raw

    if not nickname or not password:
        return jsonify({'error': '닉네임과 비밀번호를 입력해주세요.'}), 400

    # Lookup is nickname-based by product design.
    user = User.query.filter_by(nickname=nickname).first()

    if not user or not verify_password(password, user.password_hash):
        return jsonify({'error': '닉네임 또는 비밀번호가 올바르지 않습니다.'}), 401

    try:
        access_token, refresh_token = issue_token_pair(user.id, user_role=user.role.value)
    except Exception:
        db.session.rollback()
        return jsonify({'error': '토큰 발급 중 오류가 발생했습니다.'}), 500
    
    return _build_auth_response(
        message='로그인 성공',
        user_dict=user.to_dict(),
        access_token=access_token,
        refresh_token=refresh_token,
        status_code=200,
    )


@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
@limiter.limit(lambda: current_app.config.get('RATELIMIT_REFRESH_LIMIT', '20 per 10 minute'))
def refresh():
    """
    Rotate refresh token and issue a new token pair.

    Rotation ensures previously presented refresh tokens can be revoked as
    replayed/old credentials.
    """
    user_id = parse_jwt_identity_to_int()
    if user_id is None:
        return jsonify({'error': 'Invalid token identity'}), 401

    user = User.query.get(user_id)

    if not user:
        return jsonify({'error': 'User not found'}), 404

    jwt_payload = get_jwt()
    refresh_jti = jwt_payload.get('jti')
    if not refresh_jti:
        return jsonify({'error': 'Invalid refresh token'}), 401

    try:
        access_token, refresh_token, rotate_error = rotate_refresh_token_pair(
            user_id=user_id,
            refresh_jti=refresh_jti,
            user_role=user.role.value,
        )
    except Exception:
        db.session.rollback()
        return jsonify({'error': '토큰 갱신 중 오류가 발생했습니다.'}), 500

    if rotate_error:
        if rotate_error in {'invalid_refresh_token', 'refresh_token_replayed', 'refresh_token_expired'}:
            return jsonify({'error': 'Invalid refresh token'}), 401
        return jsonify({'error': 'Token refresh failed'}), 500

    return _build_refresh_response(access_token=access_token, refresh_token=refresh_token)


@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    """
    Logout current user and revoke presented tokens.
    Server clears auth cookies via unset_jwt_cookies.
    """
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404

    # Access token is always revoked; refresh token revocation is best-effort.
    jwt_payload = get_jwt() or {}
    revoke_token_jti(jwt_payload.get('jti'), reason='logout')

    cookie_refresh_token = None
    if _uses_cookie_transport():
        refresh_cookie_name = current_app.config.get('JWT_REFRESH_COOKIE_NAME', 'refresh_token_cookie')
        cookie_refresh_token = request.cookies.get(refresh_cookie_name)

    refresh_revoke_errors = []
    tokens_to_revoke = []
    if cookie_refresh_token:
        tokens_to_revoke.append(cookie_refresh_token)

    for token_value in tokens_to_revoke:
        _, refresh_revoke_error = revoke_raw_refresh_token(token_value, expected_user_id=user.id)
        if refresh_revoke_error:
            refresh_revoke_errors.append(refresh_revoke_error)

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({'error': '로그아웃 처리 중 오류가 발생했습니다.'}), 500

    if refresh_revoke_errors:
        response = jsonify({
            'message': '로그아웃 되었습니다.',
            'warning': 'refresh_token을 폐기하지 못했습니다.',
        })
    else:
        response = jsonify({'message': '로그아웃 되었습니다.'})

    if _uses_cookie_transport():
        unset_jwt_cookies(response)
    return response, 200


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_me():
    """Get current authenticated user info."""
    user = get_current_user()
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    return jsonify({
        'user': user.to_dict()
    }), 200
