"""
FastAPI application for sports league, field-trip, and school-meal sidecar APIs.

This process shares auth cookies and database contracts with the main Flask app
while hosting the async-heavy endpoints separately.

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
from .routes.field_trip import router as field_trip_router
from .routes.meals import router as meals_router
from .routes.sports_league import router as sports_league_router
from .services.field_trip import FieldTripError
from .services.meals import SchoolMealError
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
        title='범서고등학교 실시간 기능 API',
        description='Sports League Live Text Relay + Field Trip Boards — Async FastAPI Server',
        version='1.0.0',
        lifespan=lifespan,
        docs_url='/docs' if settings.ENV_NAME != 'production' else None,
        redoc_url='/redoc' if settings.ENV_NAME != 'production' else None,
    )

    # Keep the CORS contract aligned with the Flask app because the frontend talks to both origins.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_headers=[
            'Content-Type',
            'Authorization',
            'X-CSRF-TOKEN',
            'X-CSRF-Token',
            'X-Field-Trip-CSRF',
        ],
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

    # Domain exceptions stay JSON-shaped so the frontend can reuse the same error extraction pattern.
    @app.exception_handler(SportsLeagueError)
    async def sports_league_error_handler(request: Request, exc: SportsLeagueError):
        return JSONResponse(
            status_code=exc.status_code,
            content={'error': exc.message},
        )

    @app.exception_handler(FieldTripError)
    async def field_trip_error_handler(request: Request, exc: FieldTripError):
        payload = {'error': exc.message}
        if exc.error_code:
            payload['error_code'] = exc.error_code
        return JSONResponse(
            status_code=exc.status_code,
            content=payload,
        )

    @app.exception_handler(SchoolMealError)
    async def school_meal_error_handler(request: Request, exc: SchoolMealError):
        return JSONResponse(
            status_code=exc.status_code,
            content={'error': exc.message},
        )

    # Health check
    @app.get('/api/health')
    async def health():
        return {'status': 'healthy', 'message': '범서고등학교 스포츠리그 FastAPI 서버'}

    # The FastAPI process owns async-heavy feature areas while keeping the same auth/session model as Flask.
    app.include_router(sports_league_router)
    app.include_router(field_trip_router)
    app.include_router(meals_router)

    return app


app = create_app()
