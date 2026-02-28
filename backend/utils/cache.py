"""
Redis-backed response caching helpers for Flask routes.
Falls back to NullCache if Redis is disabled or unavailable.
"""
from __future__ import annotations

import hashlib
import json
from functools import wraps
from urllib.parse import urlencode

from flask import current_app, make_response, request
from flask_caching import Cache
from redis import Redis


cache = Cache()


def _parse_timeout(value, default):
    try:
        parsed = int(value)
        return parsed if parsed > 0 else default
    except (TypeError, ValueError):
        return default


def _can_connect_redis(redis_url: str, connect_timeout: int, socket_timeout: int) -> bool:
    try:
        client = Redis.from_url(
            redis_url,
            socket_connect_timeout=connect_timeout,
            socket_timeout=socket_timeout,
        )
        client.ping()
        client.close()
        return True
    except Exception:
        return False


def init_cache(app):
    """
    Initialize cache backend for the app.
    Runtime mode is stored at app.config["CACHE_RUNTIME_MODE"].
    """
    enabled = bool(app.config.get('CACHE_ENABLED', True))
    default_timeout = _parse_timeout(app.config.get('CACHE_DEFAULT_TIMEOUT', 60), 60)
    redis_url = str(app.config.get('REDIS_URL', 'redis://localhost:6379/0'))
    key_prefix = str(app.config.get('CACHE_KEY_PREFIX', 'bumseo_api:'))
    connect_timeout = _parse_timeout(app.config.get('CACHE_SOCKET_CONNECT_TIMEOUT', 1), 1)
    socket_timeout = _parse_timeout(app.config.get('CACHE_SOCKET_TIMEOUT', 1), 1)

    cache_config = {
        'CACHE_DEFAULT_TIMEOUT': default_timeout,
        'CACHE_KEY_PREFIX': key_prefix,
    }

    if enabled and _can_connect_redis(redis_url, connect_timeout, socket_timeout):
        cache_config.update(
            {
                'CACHE_TYPE': 'RedisCache',
                'CACHE_REDIS_URL': redis_url,
                'CACHE_OPTIONS': {
                    'socket_connect_timeout': connect_timeout,
                    'socket_timeout': socket_timeout,
                },
            }
        )
        runtime_mode = 'redis'
    else:
        cache_config.update({'CACHE_TYPE': 'NullCache'})
        runtime_mode = 'disabled' if not enabled else 'fallback-null'
        if enabled:
            app.logger.warning('Redis unavailable. Falling back to NullCache.')

    cache.init_app(app, config=cache_config)
    app.config['CACHE_RUNTIME_MODE'] = runtime_mode
    app.logger.info('Cache initialized: mode=%s', runtime_mode)


def _cache_actor_context() -> tuple[str, str | None]:
    """
    Resolve cache actor context from auth principal.

    Returns:
        (actor_scope, actor_role)
        actor_scope: anon or user:{id}:role:{role_or_unknown}
        actor_role: normalized role string when known, else None
    """
    try:
        from utils.security import get_current_principal, get_current_user
    except Exception:
        return 'anon', None

    try:
        principal = get_current_principal(optional=True)
    except Exception:
        principal = None

    if not principal:
        return 'anon', None

    user_id = principal.get('id')
    if user_id in (None, ''):
        return 'anon', None

    role = principal.get('role')
    if role in (None, ''):
        # Legacy tokens can miss role claim; recover once from DB.
        try:
            user = get_current_user()
        except Exception:
            user = None
        if user is not None:
            user_role = getattr(user, 'role', None)
            if hasattr(user_role, 'value'):
                role = user_role.value
            elif user_role not in (None, ''):
                role = str(user_role)

    normalized_role = str(role).strip().lower() if role not in (None, '') else 'unknown'
    actor_scope = f"user:{user_id}:role:{normalized_role}"
    return actor_scope, (normalized_role if normalized_role != 'unknown' else None)


def _normalized_query() -> str:
    """Normalize query parameters so equivalent requests share one cache key."""
    pairs = []
    for key in sorted(request.args.keys()):
        values = request.args.getlist(key)
        for value in sorted(values):
            pairs.append((key, value))
    return urlencode(pairs, doseq=True)


def _cache_key(namespace: str, actor_scope: str) -> str:
    # Include path/query/actor scope to avoid cross-user visibility leakage.
    base = f"resp|{namespace}|{request.method}|{request.path}|{_normalized_query()}|{actor_scope}"
    digest = hashlib.sha256(base.encode('utf-8')).hexdigest()
    return f"resp:{namespace}:{digest}"


def _namespace_index_key(namespace: str) -> str:
    """Namespace index stores concrete response keys for efficient invalidation."""
    return f"nsidx:{namespace}"


def _register_namespace_key(namespace: str, key: str):
    idx_key = _namespace_index_key(namespace)
    keys = cache.get(idx_key)
    if not isinstance(keys, list):
        keys = []
    if key not in keys:
        keys.append(key)
        # Safety guard against runaway key lists.
        if len(keys) > 5000:
            keys = keys[-5000:]
        base_ttl = _parse_timeout(current_app.config.get('CACHE_DEFAULT_TIMEOUT', 60), 60)
        index_ttl = max(base_ttl * 20, 3600)
        cache.set(idx_key, keys, timeout=index_ttl)


def _is_cacheable_json_response(response) -> bool:
    if response.status_code < 200 or response.status_code >= 300:
        return False
    if response.direct_passthrough:
        return False
    return bool(response.is_json)


def _serialize_response(response):
    """Serialize response essentials only (status/mimetype/body)."""
    try:
        payload = {
            'status': response.status_code,
            'mimetype': response.mimetype,
            'data': response.get_data(as_text=True),
        }
        return json.dumps(payload, ensure_ascii=False)
    except Exception:
        return None


def _deserialize_response(raw_payload):
    """Rebuild a Flask response object from serialized cache payload."""
    try:
        if isinstance(raw_payload, bytes):
            raw_payload = raw_payload.decode('utf-8')
        if not isinstance(raw_payload, str):
            return None

        payload = json.loads(raw_payload)
        data = payload.get('data', '')
        status = int(payload.get('status', 200))
        mimetype = payload.get('mimetype') or 'application/json'
        response = make_response(data, status)
        response.mimetype = mimetype
        return response
    except Exception:
        return None


def cache_json_response(namespace: str, ttl: int | None = None):
    """
    Cache JSON GET responses for a namespace.
    Cache key includes path, normalized query string, and actor scope.
    Admin requests always bypass cache read/write.
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapped(*args, **kwargs):
            debug_headers = bool(current_app.config.get('CACHE_DEBUG_HEADERS', False))
            runtime_mode = current_app.config.get('CACHE_RUNTIME_MODE', 'disabled')
            actor_scope = 'anon'
            actor_role = None

            if request.method == 'GET':
                # Compute once per request and reuse for bypass + keying.
                actor_scope, actor_role = _cache_actor_context()

            # Cache is intentionally read-only for idempotent GET traffic.
            if request.method != 'GET' or runtime_mode != 'redis' or actor_role == 'admin':
                response = make_response(view_func(*args, **kwargs))
                if debug_headers and request.method == 'GET':
                    response.headers['X-Cache'] = 'BYPASS'
                return response

            key = _cache_key(namespace, actor_scope)
            try:
                cached_payload = cache.get(key)
            except Exception:
                cached_payload = None

            if cached_payload is not None:
                cached_response = _deserialize_response(cached_payload)
                if cached_response is not None:
                    if debug_headers:
                        cached_response.headers['X-Cache'] = 'HIT'
                    return cached_response

            response = make_response(view_func(*args, **kwargs))

            if _is_cacheable_json_response(response):
                payload = _serialize_response(response)
                if payload is not None:
                    timeout = _parse_timeout(
                        ttl if ttl is not None else current_app.config.get('CACHE_DEFAULT_TIMEOUT', 60),
                        60,
                    )
                    try:
                        cache.set(key, payload, timeout=timeout)
                        _register_namespace_key(namespace, key)
                    except Exception:
                        # Cache failures must never fail the request.
                        pass

            if debug_headers:
                response.headers['X-Cache'] = 'MISS'
            return response

        return wrapped

    return decorator


def invalidate_cache_namespaces(*namespaces: str):
    """
    Invalidate all response cache keys tracked under given namespaces.
    Safe no-op when cache backend is not Redis.
    """
    if current_app.config.get('CACHE_RUNTIME_MODE') != 'redis':
        return

    for namespace in namespaces:
        if not namespace:
            continue

        idx_key = _namespace_index_key(namespace)
        try:
            keys = cache.get(idx_key)
            if not isinstance(keys, list):
                keys = []

            for key in keys:
                cache.delete(key)
            cache.delete(idx_key)
        except Exception:
            # Invalidation should not break API writes.
            continue
