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


@lru_cache()
def get_settings() -> Settings:
    return Settings()
