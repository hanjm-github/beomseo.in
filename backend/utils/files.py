"""
File utility helpers for uploads.
"""
import uuid
from pathlib import Path
from werkzeug.utils import secure_filename


def ensure_dir(path: str):
    Path(path).mkdir(parents=True, exist_ok=True)


def _require_scope(config: dict, scope: str) -> str:
    scope_dirs = config.get('UPLOAD_SCOPE_DIRS') or {}
    scope_dir = scope_dirs.get(scope)
    if not scope_dir:
        raise ValueError(f'Unsupported upload scope: {scope}')
    return scope_dir


def resolve_scope_upload_dir(config: dict, scope: str) -> str:
    upload_root = config.get('UPLOAD_ROOT') or config.get('UPLOAD_DIR') or './uploads'
    scope_dir = _require_scope(config, scope)

    root_path = Path(upload_root)
    scope_path = Path(scope_dir)
    if scope_path.is_absolute():
        resolved = scope_path
    else:
        resolved = root_path / scope_path
    return str(resolved)


def build_upload_url(config: dict, scope: str, filename: str) -> str:
    route_prefixes = config.get('UPLOAD_ROUTE_PREFIXES') or {}
    prefix = route_prefixes.get(scope)
    if not prefix:
        raise ValueError(f'Unsupported upload scope: {scope}')
    return f"{prefix.rstrip('/')}/{filename}"


def save_upload(file_storage, upload_dir: str):
    ensure_dir(upload_dir)
    original = secure_filename(file_storage.filename or '') or 'file'
    ext = Path(original).suffix.lower()
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = Path(upload_dir) / filename
    file_storage.save(str(filepath))

    return {
        'filename': filename,
        'path': str(filepath),
    }


def save_upload_for_scope(file_storage, config: dict, scope: str):
    upload_dir = resolve_scope_upload_dir(config, scope)
    saved = save_upload(file_storage, upload_dir)
    saved['url'] = build_upload_url(config, scope, saved['filename'])
    return saved
