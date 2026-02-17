"""
Flask application factory for 범서고등학교 school website backend.
"""
import os
from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager

from config import config
from models.user import db
from models import notice  # noqa: F401 ensure models are registered
from models import free_post  # noqa: F401 ensure models are registered
from models import club_recruit  # noqa: F401 ensure models are registered
from models import vote  # noqa: F401 ensure models are registered
from models import lost_found  # noqa: F401 ensure models are registered
from models import countdown_event  # noqa: F401 ensure models are registered


def create_app(config_name=None):
    """Create and configure Flask application."""
    if config_name is None:
        config_name = os.getenv('FLASK_ENV', 'development')
    
    app = Flask(__name__)
    app.config.from_object(config.get(config_name, config['default']))
    
    # Initialize extensions
    db.init_app(app)
    
    # CORS setup for React frontend
    CORS(
        app,
        origins=app.config['CORS_ORIGINS'],
        supports_credentials=True,
        allow_headers=['Content-Type', 'Authorization'],
        methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
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
    app.register_blueprint(auth_bp)
    app.register_blueprint(notices_bp)
    app.register_blueprint(free_bp)
    app.register_blueprint(club_recruit_bp)
    app.register_blueprint(subject_changes_bp)
    app.register_blueprint(petitions_bp)
    app.register_blueprint(surveys_bp)
    app.register_blueprint(votes_bp)
    app.register_blueprint(lost_found_bp)
    
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
    app.run(host='127.0.0.1', port=5000, debug=True)
