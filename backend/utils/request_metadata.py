"""
Request metadata helpers for write-path auditing.
"""
from flask import has_request_context, request

from utils.security import get_client_ip


def _normalize_ip(value):
    """Normalize IP text for DB storage."""
    if value in (None, ''):
        return None
    text = str(value).strip()
    if not text:
        return None
    return text[:64]


def _normalize_user_agent(value):
    """Normalize User-Agent text for DB storage."""
    if value in (None, ''):
        return None
    text = str(value).strip()
    if not text:
        return None
    return text[:255]


def get_request_ip_for_storage():
    """
    Return best-effort original client IP.

    Uses trusted proxy-aware logic from ``utils.security.get_client_ip``.
    """
    if not has_request_context():
        return None
    try:
        return _normalize_ip(get_client_ip())
    except Exception:
        return None


def get_request_ua_for_storage():
    """Return best-effort request User-Agent."""
    if not has_request_context():
        return None
    try:
        return _normalize_user_agent(request.headers.get('User-Agent'))
    except Exception:
        return None


def populate_new_row_request_metadata(session, flush_context, instances):
    """
    Populate ``ip_address`` and ``user_agent`` on newly inserted ORM rows.

    Only runs in request context and only fills empty fields.
    """
    del flush_context, instances  # unused by design
    if not has_request_context():
        return

    request_ip = get_request_ip_for_storage()
    request_ua = get_request_ua_for_storage()
    if request_ip is None and request_ua is None:
        return

    for instance in session.new:
        if hasattr(instance, 'ip_address'):
            current_ip = getattr(instance, 'ip_address', None)
            if current_ip in (None, '') and request_ip is not None:
                setattr(instance, 'ip_address', request_ip)

        if hasattr(instance, 'user_agent'):
            current_ua = getattr(instance, 'user_agent', None)
            if current_ua in (None, '') and request_ua is not None:
                setattr(instance, 'user_agent', request_ua)
