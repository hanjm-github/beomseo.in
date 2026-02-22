"""
File utility helpers for uploads.
"""
import io
import uuid
from pathlib import Path
from urllib.parse import unquote, urlparse
from werkzeug.utils import secure_filename


MIME_EXTENSION_MAP = {
    'image/jpeg': {'.jpg', '.jpeg'},
    'image/png': {'.png'},
    'image/gif': {'.gif'},
    'image/webp': {'.webp'},
    'application/pdf': {'.pdf'},
    'text/plain': {'.txt'},
    'application/zip': {'.zip'},
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {'.docx'},
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {'.xlsx'},
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': {'.pptx'},
    'application/msword': {'.doc'},
    'application/vnd.ms-excel': {'.xls'},
    'application/vnd.ms-powerpoint': {'.ppt'},
}

OOXML_MIME_TYPES = {
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
}

LEGACY_OFFICE_MIME_TYPES = {
    'application/msword',
    'application/vnd.ms-excel',
    'application/vnd.ms-powerpoint',
}


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


def _normalize_upload_candidate_path(path_value: str) -> str:
    path = (path_value or '').strip()
    if not path:
        return ''
    if path.startswith('./'):
        path = path[1:]
    if not path.startswith('/'):
        path = f'/{path}'
    return path


def extract_upload_filename_for_scope(config: dict, scope: str, url_value):
    if not isinstance(url_value, str):
        return None

    raw = url_value.strip()
    if not raw:
        return None

    parsed = urlparse(raw)
    path = parsed.path if (parsed.scheme or parsed.netloc) else raw
    path = _normalize_upload_candidate_path(unquote(path))
    if not path:
        return None

    route_prefixes = config.get('UPLOAD_ROUTE_PREFIXES') or {}
    prefix = route_prefixes.get(scope)
    if not prefix:
        return None

    normalized_prefix = prefix.rstrip('/')
    prefix_path = f'{normalized_prefix}/'
    if not path.startswith(prefix_path):
        return None

    filename = unquote(path[len(prefix_path):]).strip()
    if not filename or '/' in filename or '\\' in filename:
        return None
    return filename


def normalize_upload_url_for_scope(config: dict, scope: str, url_value):
    filename = extract_upload_filename_for_scope(config, scope, url_value)
    if not filename:
        return None
    return build_upload_url(config, scope, filename)


def _read_file_head(file_storage, size=1024):
    stream = getattr(file_storage, 'stream', None)
    if stream is None:
        return b''
    try:
        current = stream.tell()
    except Exception:
        current = None

    try:
        if current is not None:
            stream.seek(0)
        data = stream.read(size)
        if isinstance(data, str):
            data = data.encode('utf-8', errors='ignore')
    except Exception:
        data = b''
    finally:
        try:
            if current is not None:
                stream.seek(current)
        except Exception:
            pass
    return data or b''


def _sniff_signature_mime(head: bytes):
    if not head:
        return None
    if head.startswith(b'\x89PNG\r\n\x1a\n'):
        return 'image/png'
    if head.startswith(b'\xff\xd8\xff'):
        return 'image/jpeg'
    if head.startswith(b'GIF87a') or head.startswith(b'GIF89a'):
        return 'image/gif'
    if len(head) >= 12 and head[:4] == b'RIFF' and head[8:12] == b'WEBP':
        return 'image/webp'
    if head.startswith(b'%PDF-'):
        return 'application/pdf'
    if head.startswith((b'PK\x03\x04', b'PK\x05\x06', b'PK\x07\x08')):
        return 'application/zip'
    if head.startswith(b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1'):
        return 'application/msword'

    # Text fallback: accept if buffer appears text-like.
    if b'\x00' not in head:
        try:
            io.BytesIO(head).read().decode('utf-8')
            return 'text/plain'
        except Exception:
            pass
    return None


def _extension_allowed_for_mime(extension: str, mime: str):
    allowed = MIME_EXTENSION_MAP.get(mime, set())
    return extension in allowed


def _normalize_mime(file_storage):
    mime = (getattr(file_storage, 'mimetype', '') or '').strip().lower()
    if ';' in mime:
        mime = mime.split(';', 1)[0].strip()
    return mime


def _safe_file_size(file_storage):
    stream = getattr(file_storage, 'stream', None)
    if stream is None:
        return 0
    try:
        current = stream.tell()
        stream.seek(0, 2)
        size = stream.tell()
        stream.seek(current)
        return int(size)
    except Exception:
        return 0


def validate_upload(file_storage, config: dict, require_image: bool = False):
    """
    Strict upload validation with allowlist and content signature checks.
    """
    filename = secure_filename((getattr(file_storage, 'filename', None) or '').strip())
    if not filename:
        return {'ok': False, 'error': '파일 이름이 없습니다.'}

    extension = Path(filename).suffix.lower()
    if not extension:
        return {'ok': False, 'error': '파일 확장자가 필요합니다.'}

    max_size = int(config.get('MAX_ATTACH_SIZE', 10 * 1024 * 1024))
    size = _safe_file_size(file_storage)
    if size > max_size:
        return {'ok': False, 'error': '첨부파일 용량은 10MB 이하만 가능합니다.'}

    allowed_exts = {f".{ext.lower().lstrip('.')}" for ext in (config.get('UPLOAD_ALLOWED_EXTENSIONS') or set())}
    allowed_mimes = {str(m).lower() for m in (config.get('UPLOAD_ALLOWED_MIME_TYPES') or set())}
    if require_image:
        allowed_exts = {ext for ext in allowed_exts if ext in {'.jpg', '.jpeg', '.png', '.gif', '.webp'}}
        allowed_mimes = {mime for mime in allowed_mimes if mime.startswith('image/')}

    if extension not in allowed_exts:
        return {'ok': False, 'error': '허용되지 않은 파일 확장자입니다.'}

    provided_mime = _normalize_mime(file_storage)
    head = _read_file_head(file_storage)
    sniffed_mime = _sniff_signature_mime(head)

    candidate_mimes = []
    if provided_mime and sniffed_mime:
        compatible = (
            provided_mime == sniffed_mime
            or (sniffed_mime == 'application/zip' and provided_mime in OOXML_MIME_TYPES)
            or (sniffed_mime == 'application/msword' and provided_mime in LEGACY_OFFICE_MIME_TYPES)
        )
        if not compatible:
            return {'ok': False, 'error': '파일 서명과 MIME 타입이 일치하지 않습니다.'}
        candidate_mimes.append(provided_mime)
    else:
        if provided_mime:
            candidate_mimes.append(provided_mime)
        if sniffed_mime and sniffed_mime not in candidate_mimes:
            candidate_mimes.append(sniffed_mime)

    valid_mime = None
    for candidate in candidate_mimes:
        if candidate not in allowed_mimes:
            continue
        if candidate in MIME_EXTENSION_MAP and not _extension_allowed_for_mime(extension, candidate):
            continue
        valid_mime = candidate
        break

    if not valid_mime:
        return {'ok': False, 'error': '파일 형식을 확인할 수 없거나 허용되지 않은 형식입니다.'}

    if require_image and not valid_mime.startswith('image/'):
        return {'ok': False, 'error': '이미지 파일만 업로드할 수 있습니다.'}

    return {
        'ok': True,
        'size': size,
        'mime': valid_mime,
        'kind': 'image' if valid_mime.startswith('image/') else 'file',
        'name': filename,
        'extension': extension,
    }


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
