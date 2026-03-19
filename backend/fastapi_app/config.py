"""
Centralized FastAPI configuration using Pydantic Settings.

Reads the same backend/.env file as the Flask app for shared secrets.
"""
from __future__ import annotations

import os
from pathlib import Path
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parent.parent
_ENV_FILE = BACKEND_DIR / '.env'


def _parse_csv(value: str) -> list[str]:
    if not value:
        return []
    return [v.strip() for v in value.split(',') if v.strip()]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding='utf-8',
        extra='ignore',
    )

    # Environment
    ENV_NAME: str = os.getenv('FLASK_ENV', 'development')

    # Database (MySQL via aiomysql)
    DB_HOST: str = 'localhost'
    DB_PORT: int = 3306
    DB_USER: str = 'root'
    DB_PASSWORD: str = ''
    DB_NAME: str = 'app_db'
    DATABASE_URL: str = ''

    @property
    def async_database_url(self) -> str:
        if self.DATABASE_URL:
            # Convert mysql+pymysql:// → mysql+aiomysql://
            url = self.DATABASE_URL
            if 'pymysql' in url:
                return url.replace('pymysql', 'aiomysql')
            if url.startswith('mysql://'):
                return url.replace('mysql://', 'mysql+aiomysql://', 1)
            return url
        return (
            f'mysql+aiomysql://{self.DB_USER}:{self.DB_PASSWORD}'
            f'@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}'
        )

    # JWT
    JWT_SECRET_KEY: str = ''
    JWT_ACCESS_COOKIE_NAME: str = 'access_token_cookie'
    JWT_COOKIE_CSRF_PROTECT: bool = True
    JWT_ACCESS_CSRF_HEADER_NAME: str = 'X-CSRF-TOKEN'
    JWT_ACCESS_CSRF_COOKIE_NAME: str = 'csrf_access_token'
    JWT_COOKIE_SECURE: bool = False
    JWT_COOKIE_SAMESITE: str = 'Lax'
    JWT_COOKIE_DOMAIN: str | None = None

    # CORS
    CORS_ORIGINS: str = 'http://localhost:5173'

    @property
    def cors_origins_list(self) -> list[str]:
        return _parse_csv(self.CORS_ORIGINS)

    # Proxy trust
    TRUST_PROXY_HEADERS: bool = False
    TRUSTED_PROXY_CIDRS: str = ''

    @property
    def trusted_proxy_cidrs_list(self) -> list[str]:
        return _parse_csv(self.TRUSTED_PROXY_CIDRS)

    # Redis
    REDIS_URL: str = 'redis://localhost:6379/0'

    # Sports league SSE
    SPORTS_LEAGUE_SSE_HEARTBEAT_SECONDS: int = 15
    SPORTS_LEAGUE_SSE_RETRY_MS: int = 3000
    SPORTS_LEAGUE_MAX_STREAMS_PER_CLIENT: int = 2
    SPORTS_LEAGUE_MAX_ACTIVE_EVENTS: int = 250
    SPORTS_LEAGUE_CACHE_TTL: int = 10

    # Rate limiting
    RATELIMIT_SPORTS_LEAGUE_READ: str = '60 per minute'
    RATELIMIT_SPORTS_LEAGUE_STREAM_CONNECT: str = '12 per minute'
    RATELIMIT_WRITE_LIMIT: str = '120 per minute'

    # Uploads
    UPLOAD_ROOT: str = str(BACKEND_DIR / 'uploads')
    UPLOAD_FIELD_TRIP_DIR: str = 'field_trip'
    MAX_ATTACH_SIZE: int = 10 * 1024 * 1024
    MAX_ATTACH_COUNT: int = 5
    UPLOAD_ALLOWED_MIME_TYPES: str = (
        'image/jpeg,image/png,image/gif,image/webp,'
        'application/pdf,text/plain,application/zip,'
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document,'
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,'
        'application/vnd.openxmlformats-officedocument.presentationml.presentation,'
        'application/msword,application/vnd.ms-excel,application/vnd.ms-powerpoint'
    )
    UPLOAD_ALLOWED_EXTENSIONS: str = 'jpg,jpeg,png,gif,webp,pdf,txt,zip,doc,docx,xls,xlsx,ppt,pptx'
    UPLOAD_TEMP_PREVIEW_TTL_SECONDS: int = 86400
    UPLOAD_TEMP_PREVIEW_SIGNING_KEY: str = ''

    # Field trip
    FIELD_TRIP_UNLOCK_COOKIE_NAME: str = 'field_trip_unlock_token'
    FIELD_TRIP_CSRF_COOKIE_NAME: str = 'field_trip_csrf_token'
    FIELD_TRIP_CSRF_HEADER_NAME: str = 'X-Field-Trip-CSRF'
    FIELD_TRIP_COOKIE_PATH: str = '/api/community/field-trip'
    # The SPA must read this cookie from /community/... routes to mirror it into the write header.
    FIELD_TRIP_CSRF_COOKIE_PATH: str = '/'
    FIELD_TRIP_MAX_NICKNAME_LENGTH: int = 20
    FIELD_TRIP_MAX_TITLE_LENGTH: int = 80
    FIELD_TRIP_MAX_BODY_LENGTH: int = 1200

    @property
    def upload_allowed_mime_types_set(self) -> set[str]:
        return {value.lower() for value in _parse_csv(self.UPLOAD_ALLOWED_MIME_TYPES)}

    @property
    def upload_allowed_extensions_set(self) -> set[str]:
        return {value.lower().lstrip('.') for value in _parse_csv(self.UPLOAD_ALLOWED_EXTENSIONS)}

    @property
    def field_trip_upload_config(self) -> dict:
        return {
            'UPLOAD_ROOT': self.UPLOAD_ROOT,
            'UPLOAD_SCOPE_DIRS': {
                'field_trip': self.UPLOAD_FIELD_TRIP_DIR,
            },
            'UPLOAD_ROUTE_PREFIXES': {
                'field_trip': '/api/community/field-trip/uploads',
            },
            'MAX_ATTACH_SIZE': self.MAX_ATTACH_SIZE,
            'MAX_ATTACH_COUNT': self.MAX_ATTACH_COUNT,
            'UPLOAD_ALLOWED_MIME_TYPES': self.upload_allowed_mime_types_set,
            'UPLOAD_ALLOWED_EXTENSIONS': self.upload_allowed_extensions_set,
            'UPLOAD_TEMP_PREVIEW_TTL_SECONDS': self.UPLOAD_TEMP_PREVIEW_TTL_SECONDS,
            'UPLOAD_TEMP_PREVIEW_SIGNING_KEY': (
                self.UPLOAD_TEMP_PREVIEW_SIGNING_KEY or self.JWT_SECRET_KEY
            ),
        }


@lru_cache()
def get_settings() -> Settings:
    return Settings()
