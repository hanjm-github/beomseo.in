"""
Authentication routes for signup, login, and token management.
"""
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity,
    get_jwt
)

from models.user import db, User, UserRole
from utils.security import (
    hash_password,
    verify_password,
    get_client_ip,
    is_ip_allowed,
    get_current_user
)

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')


@auth_bp.route('/register', methods=['POST'])
def register():
    """
    Register a new user.
    IP-restricted to Ulsan Education Office network.
    """
    # Check IP restriction
    client_ip = get_client_ip()
    allowed_ips = current_app.config.get('ALLOWED_SIGNUP_IPS', [])
    
    if not is_ip_allowed(client_ip, allowed_ips):
        return jsonify({
            'error': '회원가입은 울산광역시교육청 네트워크에서만 가능합니다.',
            'error_en': 'Registration is only allowed from Ulsan Education Office network.'
        }), 403
    
    data = request.get_json()
    
    # Validate required fields
    if not data:
        return jsonify({'error': 'Request body is required'}), 400
    
    nickname = data.get('nickname', '').strip()
    password = data.get('password', '')
    
    if not nickname:
        return jsonify({'error': '닉네임을 입력해주세요.'}), 400
    
    if len(nickname) < 2 or len(nickname) > 50:
        return jsonify({'error': '닉네임은 2-50자 사이로 입력해주세요.'}), 400
    
    if not password:
        return jsonify({'error': '비밀번호를 입력해주세요.'}), 400
    
    if len(password) < 8:
        return jsonify({'error': '비밀번호는 최소 8자 이상이어야 합니다.'}), 400
    
    # Check if nickname already exists
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
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': '회원가입 처리 중 오류가 발생했습니다.'}), 500
    
    # Generate tokens
    access_token = create_access_token(identity=user.id)
    refresh_token = create_refresh_token(identity=user.id)
    
    return jsonify({
        'message': '회원가입이 완료되었습니다.',
        'user': user.to_dict(),
        'access_token': access_token,
        'refresh_token': refresh_token
    }), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    """Login with nickname and password."""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'Request body is required'}), 400
    
    nickname = data.get('nickname', '').strip()
    password = data.get('password', '')
    
    if not nickname or not password:
        return jsonify({'error': '닉네임과 비밀번호를 입력해주세요.'}), 400
    
    # Find user
    user = User.query.filter_by(nickname=nickname).first()
    
    if not user or not verify_password(password, user.password_hash):
        return jsonify({'error': '닉네임 또는 비밀번호가 올바르지 않습니다.'}), 401
    
    # Generate tokens
    access_token = create_access_token(identity=user.id)
    refresh_token = create_refresh_token(identity=user.id)
    
    return jsonify({
        'message': '로그인 성공',
        'user': user.to_dict(),
        'access_token': access_token,
        'refresh_token': refresh_token
    }), 200


@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    """Refresh access token using refresh token."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    access_token = create_access_token(identity=user_id)
    
    return jsonify({
        'access_token': access_token
    }), 200


@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    """
    Logout current user.
    Note: For full logout, client should discard tokens.
    Server-side token blacklisting can be added if needed.
    """
    return jsonify({'message': '로그아웃 되었습니다.'}), 200


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
