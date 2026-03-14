"""
Shared utility functions.
"""
from __future__ import annotations

import json
import re


def sanitize_plain_text(value: str | None, max_length: int | None = None) -> str:
    """
    Normalize plain text input for storage.
    Mirrors the Flask utils.security.sanitize_plain_text behavior.
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


def sse_message(*, event=None, data=None, retry=None, comment=None) -> str:
    """Format a Server-Sent Events message."""
    parts = []
    if comment:
        parts.append(f': {comment}')
    if retry is not None:
        parts.append(f'retry: {int(retry)}')
    if event:
        parts.append(f'event: {event}')
    if data is not None:
        payload = json.dumps(data, ensure_ascii=False)
        for line in payload.splitlines() or ['']:
            parts.append(f'data: {line}')
    return '\n'.join(parts) + '\n\n'
