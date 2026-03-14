"""
FastAPI application for sports league live text relay.

Run with:
    cd backend
    python -m uvicorn fastapi_app.main:app --host 127.0.0.1 --port 8000
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings
from .database import shutdown_engine
from .routes.sports_league import router as sports_league_router
from .services.sports_league import SportsLeagueError


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    # Startup: engine is lazily created on first use
    yield
    # Shutdown: close connection pool
    await shutdown_engine()


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title='범서고등학교 스포츠리그 API',
        description='Sports League Live Text Relay — Async FastAPI Server',
        version='1.0.0',
        lifespan=lifespan,
        docs_url='/docs' if settings.ENV_NAME != 'production' else None,
        redoc_url='/redoc' if settings.ENV_NAME != 'production' else None,
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_headers=['Content-Type', 'Authorization', 'X-CSRF-TOKEN', 'X-CSRF-Token'],
        allow_methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    )

    # Security headers middleware
    @app.middleware('http')
    async def add_security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers.setdefault('X-Content-Type-Options', 'nosniff')
        response.headers.setdefault('X-Frame-Options', 'DENY')
        response.headers.setdefault('Referrer-Policy', 'strict-origin-when-cross-origin')
        response.headers.setdefault(
            'Permissions-Policy', 'geolocation=(), microphone=(), camera=()'
        )
        if settings.ENV_NAME == 'production':
            response.headers.setdefault(
                'Strict-Transport-Security', 'max-age=31536000; includeSubDomains'
            )
        return response

    # Global exception handler for domain errors
    @app.exception_handler(SportsLeagueError)
    async def sports_league_error_handler(request: Request, exc: SportsLeagueError):
        return JSONResponse(
            status_code=exc.status_code,
            content={'error': exc.message},
        )

    # Health check
    @app.get('/api/health')
    async def health():
        return {'status': 'healthy', 'message': '범서고등학교 스포츠리그 FastAPI 서버'}

    # Mount router
    app.include_router(sports_league_router)

    return app


app = create_app()
