"""
Security utilities for authentication and authorization.
"""
import ipaddress
import re
import bcrypt
from functools import wraps
from flask import request, jsonify
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request

from models.user import User, UserRole


def hash_password(password: str) -> str:
    """Hash password using bcrypt with 12 rounds."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')


def verify_password(password: str, password_hash: str) -> bool:
    """Verify password against hash."""
    return bcrypt.checkpw(
        password.encode('utf-8'),
        password_hash.encode('utf-8')
    )


def _first_valid_ip_from_forwarded(header_value: str):
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


def get_client_ip():
    """
    Get client IP safely.
    Always prefer proxy headers before falling back to remote address.
    """
    remote_addr = request.remote_addr or ''
    forwarded = _first_valid_ip_from_forwarded(request.headers.get('X-Forwarded-For', ''))
    if forwarded:
        return forwarded
    real_ip = _first_valid_ip_from_forwarded(request.headers.get('X-Real-IP', ''))
    if real_ip:
        return real_ip

    if remote_addr:
        try:
            ipaddress.ip_address(remote_addr)
            return remote_addr
        except ValueError:
            return None
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
            
            user_id = parse_jwt_identity_to_int()
            if user_id is None:
                return jsonify({'error': 'Invalid token identity'}), 401
            user = User.query.get(user_id)
            
            if not user:
                return jsonify({'error': 'User not found'}), 404
            
            # Admin has access to everything
            if user.role == UserRole.ADMIN:
                return f(*args, **kwargs)
            
            # Check if user has required role
            if user.role not in roles:
                return jsonify({'error': 'Insufficient permissions'}), 403
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator


def get_current_user():
    """Get current authenticated user from JWT."""
    user_id = parse_jwt_identity_to_int()
    if user_id is not None:
        return User.query.get(user_id)
    return None


def parse_jwt_identity_to_int():
    """
    Parse JWT identity as integer user id.
    Returns None if identity is missing or malformed.
    """
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
