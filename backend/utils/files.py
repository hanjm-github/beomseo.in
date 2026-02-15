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

    return {
        'filename': filename,
        'path': filepath,
        'url': f"{(base_url.rstrip('/') if base_url else '/api/notices/uploads')}/{filename}"
    }
