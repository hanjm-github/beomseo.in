"""
Flask application configuration.
Loads environment variables and provides config class for Flask.
"""
import os
from datetime import timedelta
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

BACKEND_DIR = Path(__file__).resolve().parent


def _parse_origins(value: str):
    """Parse comma-separated origins into a clean list, keeping wildcard if provided."""
    if not value:
        return []
    return [v.strip() for v in value.split(',') if v.strip()]


class Config:
    """Flask configuration class."""
    
    # Database
    DB_HOST = os.getenv('DB_HOST', 'localhost')
    DB_PORT = os.getenv('DB_PORT', '3306')
    DB_USER = os.getenv('DB_USER', 'root')
    DB_PASSWORD = os.getenv('DB_PASSWORD', '')
    DB_NAME = os.getenv('DB_NAME', 'app_db')
    
    SQLALCHEMY_DATABASE_URI = (
        f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # JWT Settings
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'dev-secret-key-change-in-production')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=30)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=7)
    JWT_TOKEN_LOCATION = ['headers']
    JWT_HEADER_NAME = 'Authorization'
    JWT_HEADER_TYPE = 'Bearer'
    
    # CORS Settings (managed via .env CORS_ORIGINS)
    CORS_ORIGINS_RAW = os.getenv('CORS_ORIGINS', 'http://localhost:5173')
    CORS_ORIGINS = _parse_origins(CORS_ORIGINS_RAW)
    
    # Uploads
    UPLOAD_ROOT = os.getenv('UPLOAD_ROOT', str(BACKEND_DIR / 'uploads'))
    UPLOAD_DIR = UPLOAD_ROOT  # Backward-compatible alias
    UPLOAD_SCOPE_DIRS = {
        'notices': os.getenv('UPLOAD_NOTICES_DIR', 'notices'),
        'free': os.getenv('UPLOAD_FREE_DIR', 'free'),
        'club_recruit': os.getenv('UPLOAD_CLUB_RECRUIT_DIR', 'club_recruit'),
        'lost_found': os.getenv('UPLOAD_LOST_FOUND_DIR', 'lost_found'),
    }
    UPLOAD_ROUTE_PREFIXES = {
        'notices': '/api/notices/uploads',
        'free': '/api/community/free/uploads',
        'club_recruit': '/api/club-recruit/uploads',
        'lost_found': '/api/community/lost-found/uploads',
    }
    MAX_ATTACH_SIZE = int(os.getenv('MAX_ATTACH_SIZE', 10 * 1024 * 1024))  # 10MB
    MAX_ATTACH_COUNT = int(os.getenv('MAX_ATTACH_COUNT', 5))

    # Petition settings
    DEFAULT_PETITION_THRESHOLD = int(os.getenv('DEFAULT_PETITION_THRESHOLD', 50))
    MAX_PETITION_BODY = int(os.getenv('MAX_PETITION_BODY', 10_000))

    # Survey exchange
    SURVEY_BASE_QUOTA = int(os.getenv('SURVEY_BASE_QUOTA', 0))
    SURVEY_APPROVAL_GRANT = int(os.getenv('SURVEY_APPROVAL_GRANT', 30))

    # Realtime vote board
    VOTE_MIN_TITLE_LENGTH = int(os.getenv('VOTE_MIN_TITLE_LENGTH', 2))
    VOTE_MAX_TITLE_LENGTH = int(os.getenv('VOTE_MAX_TITLE_LENGTH', 120))
    VOTE_MAX_DESCRIPTION_LENGTH = int(os.getenv('VOTE_MAX_DESCRIPTION_LENGTH', 1000))
    VOTE_MIN_OPTIONS = int(os.getenv('VOTE_MIN_OPTIONS', 2))
    VOTE_MAX_OPTIONS = int(os.getenv('VOTE_MAX_OPTIONS', 8))
    VOTE_MAX_OPTION_LENGTH = int(os.getenv('VOTE_MAX_OPTION_LENGTH', 80))
    VOTE_REWARD_CREDITS = int(os.getenv('VOTE_REWARD_CREDITS', 1))
    
    # IP Restriction for signup (Ulsan Education Office network)
    # Add actual IP ranges as needed
    ALLOWED_SIGNUP_IPS = [
        '127.0.0.1',        # localhost for development
        '::1',              # localhost IPv6
        '10.0.0.0/8',       # Private network (modify as needed)
        '172.16.0.0/12',    # Private network
        '192.168.0.0/16',   # Private network
    ]


class DevelopmentConfig(Config):
    """Development configuration."""
    DEBUG = True


class ProductionConfig(Config):
    """Production configuration."""
    DEBUG = False


# Config mapping
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}
