"""
Rate limiter initialization and shared policies.
"""
from flask import jsonify
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address


def _rate_limit_key():
    try:
        verify_jwt_in_request(optional=True)
        identity = get_jwt_identity()
        if identity:
            return f'user:{identity}'
    except Exception:
        pass
    remote = get_remote_address() or 'unknown'
    return f'ip:{remote}'


limiter = Limiter(
    key_func=_rate_limit_key,
    default_limits=[],
    headers_enabled=True,
)


def init_limiter(app):
    storage_uri = app.config.get('RATELIMIT_STORAGE_URI') or 'memory://'
    app.config.setdefault('RATELIMIT_STORAGE_URI', storage_uri)
    app.config.setdefault('RATELIMIT_HEADERS_ENABLED', True)
    app.config.setdefault('RATELIMIT_SWALLOW_ERRORS', True)
    limiter.init_app(app)


def apply_blueprint_write_limit(blueprint, limit_value):
    if not blueprint:
        return
    if getattr(blueprint, '_write_limit_applied', False):
        return
    limiter.limit(limit_value, methods=['POST', 'PUT', 'PATCH', 'DELETE'])(blueprint)
    setattr(blueprint, '_write_limit_applied', True)


def build_rate_limit_response(retry_after=None):
    payload = {
        'error': '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
        'error_code': 'rate_limit_exceeded',
    }
    if retry_after is not None:
        payload['retry_after'] = int(retry_after)
    response = jsonify(payload)
    response.status_code = 429
    if retry_after is not None:
        response.headers['Retry-After'] = str(int(retry_after))
    return response
