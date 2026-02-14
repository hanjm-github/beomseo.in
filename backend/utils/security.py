"""
Security utilities for authentication and authorization.
"""
import ipaddress
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


def get_client_ip() -> str:
    """Get client IP address from request, supporting proxies."""
    # Check X-Forwarded-For header (for reverse proxy/nginx)
    if request.headers.get('X-Forwarded-For'):
        return request.headers.get('X-Forwarded-For').split(',')[0].strip()
    # Check X-Real-IP header
    if request.headers.get('X-Real-IP'):
        return request.headers.get('X-Real-IP')
    # Fall back to remote address
    return request.remote_addr or '127.0.0.1'


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
            
            user_id_str = get_jwt_identity()
            user_id = int(user_id_str)  # Convert string back to int for DB query
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
    user_id_str = get_jwt_identity()
    if user_id_str:
        user_id = int(user_id_str)  # Convert string back to int for DB query
        return User.query.get(user_id)
    return None
