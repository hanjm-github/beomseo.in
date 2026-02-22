"""
Flask application factory for beomseo.in school website backend.
"""
import os
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_limiter.errors import RateLimitExceeded

from config import config
from models.user import db
from models import notice  # noqa: F401 ensure models are registered
from models import free_post  # noqa: F401 ensure models are registered
from models import club_recruit  # noqa: F401 ensure models are registered
from models import vote  # noqa: F401 ensure models are registered
from models import lost_found  # noqa: F401 ensure models are registered
from models import countdown_event  # noqa: F401 ensure models are registered
from models import gomsol_market  # noqa: F401 ensure models are registered
from models import auth_token  # noqa: F401 ensure models are registered
from utils.cache import init_cache
from utils.rate_limit import (
    limiter,
    init_limiter,
    apply_blueprint_write_limit,
    build_rate_limit_response,
)
from utils.security_tokens import is_token_blocked


INSECURE_JWT_SECRETS = {
    '',
    'dev-secret-key-change-in-production',
    'dev-local-only-change-me-please-123',
    'change_me_to_a_long_random_secret_value_32_chars_min',
    'secret',
    'changeme',
}


def validate_security_config(app):
    errors = []
    env_name = str(app.config.get('ENV_NAME', 'development')).lower()
    secret = app.config.get('JWT_SECRET_KEY') or ''
    min_len = int(app.config.get('JWT_MIN_SECRET_LENGTH', 32))

    if not secret:
        errors.append('JWT_SECRET_KEY is required.')
    if len(secret) < min_len:
        errors.append(f'JWT_SECRET_KEY must be at least {min_len} characters.')
    if env_name == 'production' and secret in INSECURE_JWT_SECRETS:
        errors.append('JWT_SECRET_KEY uses an insecure production value.')
    if env_name == 'production' and not app.config.get('CORS_ORIGINS'):
        errors.append('CORS_ORIGINS must not be empty in production.')
    if int(app.config.get('MAX_CONTENT_LENGTH', 0)) <= 0:
        errors.append('MAX_CONTENT_LENGTH must be positive.')

    if errors:
        raise RuntimeError('Invalid security configuration: ' + '; '.join(errors))


def create_app(config_name=None):
    """Create and configure Flask application."""
    if config_name is None:
        config_name = os.getenv('FLASK_ENV', 'development')

    app = Flask(__name__)
    app.config.from_object(config.get(config_name, config['default']))
    app.config['ENV_NAME'] = config_name
    validate_security_config(app)

    # Initialize extensions
    init_cache(app)
    db.init_app(app)
    init_limiter(app)

    # CORS setup for React frontend
    CORS(
        app,
        origins=app.config['CORS_ORIGINS'],
        supports_credentials=False,
        allow_headers=['Content-Type', 'Authorization'],
        methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
    )

    # JWT setup
    jwt = JWTManager(app)

    # JWT error handlers
    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return jsonify({
            'error': '토큰이 만료되었습니다.',
            'error_code': 'token_expired'
        }), 401
    
    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        return jsonify({
            'error': '유효하지 않은 토큰입니다.',
            'error_code': 'invalid_token'
        }), 401
    
    @jwt.unauthorized_loader
    def missing_token_callback(error):
        return jsonify({
            'error': '인증이 필요합니다.',
            'error_code': 'authorization_required'
        }), 401

    @jwt.revoked_token_loader
    def revoked_token_callback(jwt_header, jwt_payload):
        return jsonify({
            'error': '로그아웃되었거나 폐기된 토큰입니다.',
            'error_code': 'token_revoked'
        }), 401

    @jwt.token_in_blocklist_loader
    def token_in_blocklist(jwt_header, jwt_payload):
        return is_token_blocked(jwt_payload)

    @app.errorhandler(RateLimitExceeded)
    def handle_rate_limit(error):
        retry_after = getattr(error, 'retry_after', None)
        return build_rate_limit_response(retry_after=retry_after)

    @app.after_request
    def set_security_headers(response):
        response.headers.setdefault('X-Content-Type-Options', 'nosniff')
        response.headers.setdefault('X-Frame-Options', 'DENY')
        response.headers.setdefault('Referrer-Policy', 'strict-origin-when-cross-origin')
        response.headers.setdefault('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
        if app.config.get('ENV_NAME') == 'production' and request.is_secure:
            response.headers.setdefault('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
        return response

    # Register blueprints
    from routes.auth import auth_bp
    from routes.notices import notices_bp
    from routes.free import free_bp
    from routes.club_recruit import club_recruit_bp
    from routes.subject_changes import subject_changes_bp
    from routes.petitions import petitions_bp
    from routes.surveys import surveys_bp
    from routes.votes import votes_bp
    from routes.lost_found import lost_found_bp
    from routes.gomsol_market import gomsol_market_bp

    write_limit = app.config.get('RATELIMIT_WRITE_LIMIT', '120 per minute')
    apply_blueprint_write_limit(notices_bp, write_limit)
    apply_blueprint_write_limit(free_bp, write_limit)
    apply_blueprint_write_limit(club_recruit_bp, write_limit)
    apply_blueprint_write_limit(subject_changes_bp, write_limit)
    apply_blueprint_write_limit(petitions_bp, write_limit)
    apply_blueprint_write_limit(surveys_bp, write_limit)
    apply_blueprint_write_limit(votes_bp, write_limit)
    apply_blueprint_write_limit(lost_found_bp, write_limit)
    apply_blueprint_write_limit(gomsol_market_bp, write_limit)

    app.register_blueprint(auth_bp)
    app.register_blueprint(notices_bp)
    app.register_blueprint(free_bp)
    app.register_blueprint(club_recruit_bp)
    app.register_blueprint(subject_changes_bp)
    app.register_blueprint(petitions_bp)
    app.register_blueprint(surveys_bp)
    app.register_blueprint(votes_bp)
    app.register_blueprint(lost_found_bp)
    app.register_blueprint(gomsol_market_bp)

    # Health check endpoint
    @app.route('/api/health')
    def health():
        return jsonify({'status': 'healthy', 'message': '범서고등학교 API 서버'}), 200

    # Create database tables
    with app.app_context():
        db.create_all()

    return app


# Application instance for direct running
app = create_app()

if __name__ == '__main__':
    app.run(
        host='127.0.0.1',
        port=5000,
        debug=bool(app.config.get('DEBUG', False)),
    )
