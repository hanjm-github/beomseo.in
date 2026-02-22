"""
Centralized Flask configuration.

This module is intentionally declarative: every environment-facing runtime
policy (security, upload constraints, caching, and board defaults) lives here
 so behavior can be audited without scanning route code.
"""
import os
from datetime import timedelta
from pathlib import Path
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent

# Load environment variables from backend/.env regardless of process cwd.
load_dotenv(BACKEND_DIR / '.env')


def _parse_origins(value: str):
    """Parse comma-separated origins into a clean list, keeping wildcard if provided."""
    if not value:
        return []
    return [v.strip() for v in value.split(',') if v.strip()]


def _parse_csv(value: str):
    """Parse comma-separated values into a normalized list."""
    if not value:
        return []
    return [v.strip() for v in value.split(',') if v.strip()]


def _parse_nickname_banned_words(value: str):
    """Parse comma-separated banned words for nickname moderation."""
    if not value:
        return []
    words = [v.strip() for v in value.split(',') if v.strip()]
    return list(dict.fromkeys(words))


def _parse_bool(value, default=False):
    """Parse common boolean env values safely."""
    if value is None:
        return default
    return str(value).strip().lower() in {'1', 'true', 'yes', 'on'}


def _parse_int(value, default=0):
    """Parse int env values safely."""
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


class Config:
    """
    Base configuration shared by all environments.

    Production overrides should only tighten constraints, never relax them.
    """

    ENV_NAME = os.getenv('FLASK_ENV', 'development')
    # Startup can require explicit env selection to prevent accidental defaults.
    REQUIRE_EXPLICIT_ENV = _parse_bool(os.getenv('REQUIRE_EXPLICIT_ENV', 'true'), default=True)

    # Database
    DATABASE_URL = os.getenv('DATABASE_URL')
    DB_HOST = os.getenv('DB_HOST', 'localhost')
    DB_PORT = os.getenv('DB_PORT', '3306')
    DB_USER = os.getenv('DB_USER', 'root')
    DB_PASSWORD = os.getenv('DB_PASSWORD', '')
    DB_NAME = os.getenv('DB_NAME', 'app_db')

    SQLALCHEMY_DATABASE_URI = DATABASE_URL or (
        f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # JWT Settings
    # Secret quality is enforced again during app bootstrap (fail-fast).
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', '')
    JWT_MIN_SECRET_LENGTH = _parse_int(os.getenv('JWT_MIN_SECRET_LENGTH', 32), 32)
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=30)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=7)
    JWT_TOKEN_LOCATION = ['headers']
    JWT_HEADER_NAME = 'Authorization'
    JWT_HEADER_TYPE = 'Bearer'
    JWT_ERROR_MESSAGE_KEY = 'error'

    # CORS Settings (managed via .env CORS_ORIGINS)
    CORS_ORIGINS_RAW = os.getenv('CORS_ORIGINS', 'http://localhost:5173')
    CORS_ORIGINS = _parse_origins(CORS_ORIGINS_RAW)

    # Proxy trust
    # Forwarded headers are only trusted when enabled and (optionally)
    # when the direct peer IP belongs to TRUSTED_PROXY_CIDRS.
    TRUST_PROXY_HEADERS = _parse_bool(os.getenv('TRUST_PROXY_HEADERS', 'false'), default=False)
    TRUSTED_PROXY_CIDRS_RAW = os.getenv('TRUSTED_PROXY_CIDRS', '')
    TRUSTED_PROXY_CIDRS = _parse_csv(TRUSTED_PROXY_CIDRS_RAW)

    # Cache / Redis
    # Redis is optional at runtime; cache helpers degrade to NullCache.
    CACHE_ENABLED = _parse_bool(os.getenv('CACHE_ENABLED', 'true'), default=True)
    REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
    CACHE_DEFAULT_TIMEOUT = _parse_int(os.getenv('CACHE_DEFAULT_TIMEOUT', 60), 60)
    CACHE_KEY_PREFIX = os.getenv('CACHE_KEY_PREFIX', 'beomseo_in_api:')
    CACHE_DEBUG_HEADERS = _parse_bool(os.getenv('CACHE_DEBUG_HEADERS', 'false'), default=False)
    CACHE_SOCKET_CONNECT_TIMEOUT = _parse_int(os.getenv('CACHE_SOCKET_CONNECT_TIMEOUT', 1), 1)
    CACHE_SOCKET_TIMEOUT = _parse_int(os.getenv('CACHE_SOCKET_TIMEOUT', 1), 1)

    # Rate limiting
    # Route-level overrides (login/register/refresh) are applied in blueprints.
    RATELIMIT_STORAGE_URI = os.getenv('RATELIMIT_STORAGE_URI', REDIS_URL if REDIS_URL else 'memory://')
    RATELIMIT_DEFAULT = os.getenv('RATELIMIT_DEFAULT', '300 per hour')
    RATELIMIT_WRITE_LIMIT = os.getenv('RATELIMIT_WRITE_LIMIT', '120 per minute')
    RATELIMIT_LOGIN_LIMIT = os.getenv('RATELIMIT_LOGIN_LIMIT', '5 per minute')
    RATELIMIT_REGISTER_LIMIT = os.getenv('RATELIMIT_REGISTER_LIMIT', '5 per 10 minute')
    RATELIMIT_REFRESH_LIMIT = os.getenv('RATELIMIT_REFRESH_LIMIT', '20 per 10 minute')
    RATELIMIT_SWALLOW_ERRORS = _parse_bool(os.getenv('RATELIMIT_SWALLOW_ERRORS', 'true'), default=True)

    # Nickname moderation
    NICKNAME_BANNED_WORDS_RAW = os.getenv(
        'NICKNAME_BANNED_WORDS',
        os.getenv('BANNED_NICKNAME_WORDS', ''),
    )
    NICKNAME_BANNED_WORDS = _parse_nickname_banned_words(NICKNAME_BANNED_WORDS_RAW)
    
    # Uploads
    # Scope directories and URL prefixes must stay aligned for safe URL checks.
    UPLOAD_ROOT = os.getenv('UPLOAD_ROOT', str(BACKEND_DIR / 'uploads'))
    UPLOAD_DIR = UPLOAD_ROOT  # Backward-compatible alias
    UPLOAD_SCOPE_DIRS = {
        'notices': os.getenv('UPLOAD_NOTICES_DIR', 'notices'),
        'free': os.getenv('UPLOAD_FREE_DIR', 'free'),
        'club_recruit': os.getenv('UPLOAD_CLUB_RECRUIT_DIR', 'club_recruit'),
        'lost_found': os.getenv('UPLOAD_LOST_FOUND_DIR', 'lost_found'),
        'gomsol_market': os.getenv('UPLOAD_GOMSOL_MARKET_DIR', 'gomsol_market'),
    }
    UPLOAD_ROUTE_PREFIXES = {
        'notices': '/api/notices/uploads',
        'free': '/api/community/free/uploads',
        'club_recruit': '/api/club-recruit/uploads',
        'lost_found': '/api/community/lost-found/uploads',
        'gomsol_market': '/api/community/gomsol-market/uploads',
    }
    MAX_ATTACH_SIZE = int(os.getenv('MAX_ATTACH_SIZE', 10 * 1024 * 1024))  # 10MB per file
    MAX_ATTACH_COUNT = int(os.getenv('MAX_ATTACH_COUNT', 5))
    MAX_CONTENT_LENGTH = int(os.getenv('MAX_CONTENT_LENGTH', 12 * 1024 * 1024))
    UPLOAD_ALLOWED_MIME_TYPES = set(
        _parse_csv(
            os.getenv(
                'UPLOAD_ALLOWED_MIME_TYPES',
                (
                    'image/jpeg,image/png,image/gif,image/webp,'
                    'application/pdf,text/plain,application/zip,'
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document,'
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,'
                    'application/vnd.openxmlformats-officedocument.presentationml.presentation,'
                    'application/msword,application/vnd.ms-excel,application/vnd.ms-powerpoint'
                ),
            )
        )
    )
    UPLOAD_ALLOWED_EXTENSIONS = set(
        _parse_csv(
            os.getenv(
                'UPLOAD_ALLOWED_EXTENSIONS',
                'jpg,jpeg,png,gif,webp,pdf,txt,zip,doc,docx,xls,xlsx,ppt,pptx',
            )
        )
    )
    # Temporary preview URLs for uploads that are not yet linked to a saved row.
    UPLOAD_TEMP_PREVIEW_TTL_SECONDS = _parse_int(os.getenv('UPLOAD_TEMP_PREVIEW_TTL_SECONDS', 86400), 86400)
    UPLOAD_TEMP_PREVIEW_SIGNING_KEY = os.getenv('UPLOAD_TEMP_PREVIEW_SIGNING_KEY') or JWT_SECRET_KEY

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
    # Comma-separated IP/CIDR ranges from .env
    ALLOWED_SIGNUP_IPS_RAW = os.getenv(
        'ALLOWED_SIGNUP_IPS',
        '127.0.0.1,::1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16',
    )
    ALLOWED_SIGNUP_IPS = _parse_csv(ALLOWED_SIGNUP_IPS_RAW)

    # Schema bootstrap behavior
    AUTO_CREATE_TABLES = _parse_bool(os.getenv('AUTO_CREATE_TABLES', 'false'), default=False)


class DevelopmentConfig(Config):
    """Development configuration."""
    DEBUG = True
    # Development fallback only; production must provide an explicit secret.
    JWT_SECRET_KEY = Config.JWT_SECRET_KEY or 'dev-local-only-change-me-please-123'
    AUTO_CREATE_TABLES = _parse_bool(os.getenv('AUTO_CREATE_TABLES', 'true'), default=True)
    RATELIMIT_SWALLOW_ERRORS = _parse_bool(os.getenv('RATELIMIT_SWALLOW_ERRORS', 'true'), default=True)


class ProductionConfig(Config):
    """Production configuration."""
    DEBUG = False
    AUTO_CREATE_TABLES = _parse_bool(os.getenv('AUTO_CREATE_TABLES', 'false'), default=False)
    RATELIMIT_SWALLOW_ERRORS = _parse_bool(os.getenv('RATELIMIT_SWALLOW_ERRORS', 'false'), default=False)


# Config mapping
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}
