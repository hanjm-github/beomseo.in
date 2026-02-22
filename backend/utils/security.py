"""
Security utilities shared by route handlers.

The helpers in this module centralize identity parsing, authorization checks,
and input normalization so board routes stay consistent.
"""
import ipaddress
import re
import bcrypt
from urllib.parse import urlparse
from functools import wraps
from flask import request, jsonify, g, current_app
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request, get_jwt

from models.user import User, UserRole


def hash_password(password: str) -> str:
    """Hash password using bcrypt with 12 rounds."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')


def verify_password(password: str, password_hash: str) -> bool:
    """Verify password against hash."""
    if not isinstance(password, str) or not isinstance(password_hash, str):
        return False
    return bcrypt.checkpw(
        password.encode('utf-8'),
        password_hash.encode('utf-8')
    )


def _first_valid_ip_from_forwarded(header_value: str):
    """Return the first syntactically valid IP from a forwarded header chain."""
    if not header_value:
        return None
    for part in header_value.split(','):
        candidate = part.strip()
        if not candidate:
            continue
        try:
            ipaddress.ip_address(candidate)
            return candidate
        except ValueError:
            continue
    return None


def _ip_in_cidrs(ip_value: str, cidr_ranges: list) -> bool:
    """Return True when ip_value belongs to at least one CIDR/IP entry."""
    try:
        addr = ipaddress.ip_address(ip_value)
    except ValueError:
        return False

    for raw in cidr_ranges or []:
        candidate = str(raw or '').strip()
        if not candidate:
            continue
        try:
            if '/' in candidate:
                if addr in ipaddress.ip_network(candidate, strict=False):
                    return True
            elif addr == ipaddress.ip_address(candidate):
                return True
        except ValueError:
            continue
    return False


def _should_trust_proxy_headers(remote_ip: str) -> bool:
    """
    Determine if forwarded headers can be trusted for this request.

    Trust is opt-in. If TRUSTED_PROXY_CIDRS is configured, the direct
    peer (REMOTE_ADDR) must match one of those ranges.
    """
    try:
        raw_trust_proxy_headers = current_app.config.get('TRUST_PROXY_HEADERS', False)
        raw_trusted_proxy_cidrs = current_app.config.get('TRUSTED_PROXY_CIDRS', []) or []
    except RuntimeError:
        return False

    if isinstance(raw_trust_proxy_headers, bool):
        trust_proxy_headers = raw_trust_proxy_headers
    else:
        trust_proxy_headers = str(raw_trust_proxy_headers).strip().lower() in {'1', 'true', 'yes', 'on'}

    if isinstance(raw_trusted_proxy_cidrs, str):
        trusted_proxy_cidrs = [part.strip() for part in raw_trusted_proxy_cidrs.split(',') if part.strip()]
    elif isinstance(raw_trusted_proxy_cidrs, (list, tuple, set)):
        trusted_proxy_cidrs = list(raw_trusted_proxy_cidrs)
    else:
        trusted_proxy_cidrs = []

    if not trust_proxy_headers:
        return False
    if not remote_ip:
        return False
    if not trusted_proxy_cidrs:
        return True
    return _ip_in_cidrs(remote_ip, trusted_proxy_cidrs)


def get_client_ip():
    """
    Get client IP safely.
    Proxy headers are only used when explicitly trusted.
    """
    remote_addr = (request.remote_addr or '').strip()
    remote_ip = None
    if remote_addr:
        try:
            ipaddress.ip_address(remote_addr)
            remote_ip = remote_addr
        except ValueError:
            remote_ip = None

    if _should_trust_proxy_headers(remote_ip or ''):
        forwarded = _first_valid_ip_from_forwarded(request.headers.get('X-Forwarded-For', ''))
        if forwarded:
            return forwarded
        real_ip = _first_valid_ip_from_forwarded(request.headers.get('X-Real-IP', ''))
        if real_ip:
            return real_ip

    if remote_ip:
        return remote_ip
    return None


def is_ip_allowed(client_ip: str, allowed_ranges: list) -> bool:
    """
    Check if client IP is in allowed ranges.
    Supports both single IPs and CIDR notation.
    """
    try:
        client_addr = ipaddress.ip_address(client_ip)
        for allowed in allowed_ranges:
            try:
                # Check if it's a network (CIDR notation)
                if '/' in allowed:
                    network = ipaddress.ip_network(allowed, strict=False)
                    if client_addr in network:
                        return True
                else:
                    # Single IP comparison
                    if client_addr == ipaddress.ip_address(allowed):
                        return True
            except ValueError:
                continue
        return False
    except ValueError:
        return False


def require_role(*roles: UserRole):
    """
    Decorator to require specific roles for endpoint access.
    Admin role has access to everything.
    
    Usage:
        @require_role(UserRole.ADMIN)
        @require_role(UserRole.STUDENT_COUNCIL, UserRole.ADMIN)
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            verify_jwt_in_request()

            principal = get_current_principal(optional=False)
            if principal is None:
                return jsonify({'error': 'Invalid token identity'}), 401

            # Prefer trusted JWT role claim to avoid extra DB lookups on hot paths.
            principal_role = principal.get('role')
            if principal_role:
                if principal_role == UserRole.ADMIN.value:
                    return f(*args, **kwargs)
                allowed_roles = {role.value if isinstance(role, UserRole) else str(role) for role in roles}
                if principal_role in allowed_roles:
                    return f(*args, **kwargs)
                return jsonify({'error': 'Insufficient permissions'}), 403

            # Fallback for legacy tokens without role claim.
            user = get_current_user()
            if not user:
                return jsonify({'error': 'User not found'}), 404

            if user.role == UserRole.ADMIN:
                return f(*args, **kwargs)

            if user.role not in roles:
                return jsonify({'error': 'Insufficient permissions'}), 403

            return f(*args, **kwargs)
        return decorated_function
    return decorator


def get_current_user():
    """
    Get current authenticated user from JWT identity.

    Result is memoized in ``flask.g`` to avoid repeated lookups in one request.
    """
    if hasattr(g, '_current_user'):
        return g._current_user

    principal = get_current_principal(optional=True)
    if principal is None:
        g._current_user = None
        return None

    user = User.query.get(principal['id'])
    g._current_user = user
    return user


def get_current_principal(optional=True):
    """
    Return current auth principal with lightweight fields.
    Shape: {'id': int, 'role': str|None}
    """
    # Request-scope memoization keeps role checks cheap on hot endpoints.
    if hasattr(g, '_current_principal'):
        return g._current_principal

    try:
        verify_jwt_in_request(optional=optional)
    except Exception:
        g._current_principal = None
        return None

    user_id = parse_jwt_identity_to_int()
    if user_id is None:
        g._current_principal = None
        return None

    # Role claim can be absent for legacy tokens issued before role embedding.
    claims = get_jwt() or {}
    role = claims.get('role')
    principal = {
        'id': user_id,
        'role': str(role) if role not in (None, '') else None,
    }
    g._current_principal = principal
    return principal


def get_current_user_role():
    """
    Return current authenticated role string.
    Uses JWT role claim first; falls back to DB lookup for legacy tokens.
    """
    principal = get_current_principal(optional=True)
    if principal is None:
        return None

    if principal.get('role'):
        return principal['role']

    user = get_current_user()
    return user.role.value if user else None


def parse_jwt_identity_to_int():
    """
    Parse JWT identity as integer user id.
    Returns None if identity is missing or malformed.
    """
    # Reuse already-parsed principal when available.
    principal = getattr(g, '_current_principal', None)
    if isinstance(principal, dict) and principal.get('id') is not None:
        return principal['id']

    user_id_str = get_jwt_identity()
    if user_id_str in (None, ''):
        return None
    try:
        return int(str(user_id_str))
    except (TypeError, ValueError):
        return None


def sanitize_plain_text(value: str, max_length: int = None):
    """
    Normalize plain text input for storage in non-HTML fields.
    Collapses dangerous control chars and trims surrounding spaces.
    """
    if value is None:
        return ''

    text = str(value)
    text = text.replace('\r\n', '\n').replace('\r', '\n')
    text = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', text)
    text = text.strip()
    if max_length is not None and max_length >= 0:
        text = text[:max_length]
    return text


def is_safe_http_url(value: str) -> bool:
    """Validate absolute HTTP/HTTPS URL shape for stored external links."""
    if not isinstance(value, str):
        return False

    candidate = value.strip()
    if not candidate:
        return False

    if any(ch in candidate for ch in ('\r', '\n', '\t', '\x00')):
        return False

    try:
        parsed = urlparse(candidate)
    except ValueError:
        return False

    if parsed.scheme not in {'http', 'https'}:
        return False
    if not parsed.netloc:
        return False
    if parsed.username or parsed.password:
        return False
    return True


def is_safe_open_chat_url(value: str) -> bool:
    """
    Validate Kakao Open Chat URL.

    Only open.kakao.com links are accepted.
    """
    if not is_safe_http_url(value):
        return False

    parsed = urlparse(value.strip())
    host = (parsed.hostname or '').lower()
    if host != 'open.kakao.com':
        return False
    return True
