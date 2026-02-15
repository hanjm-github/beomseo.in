"""
File utility helpers for uploads.
"""
import os
import uuid
from werkzeug.utils import secure_filename


def ensure_dir(path: str):
    os.makedirs(path, exist_ok=True)


def save_upload(file_storage, upload_dir: str, base_url: str = None):
    ensure_dir(upload_dir)
    original = secure_filename(file_storage.filename or 'file')
    ext = ''
    if '.' in original:
        ext = '.' + original.rsplit('.', 1)[1]
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(upload_dir, filename)
    file_storage.save(filepath)

    if base_url:
        url = f"{base_url.rstrip('/')}/{filename}"
    else:
        url = f"/api/notices/uploads/{filename}"

    return {
        'filename': filename,
        'path': filepath,
        'url': url,
    }
