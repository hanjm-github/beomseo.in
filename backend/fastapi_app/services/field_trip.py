"""
Async field-trip event domain logic.
"""
from __future__ import annotations

import mimetypes
import shutil
import uuid
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy import Integer, cast, func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from utils.files import (
    build_upload_preview_url,
    build_upload_url,
    ensure_dir,
    extract_upload_filename_for_scope,
    is_valid_upload_preview_token,
    resolve_scope_upload_dir,
    save_upload_for_scope,
    validate_upload,
)
from utils.security import hash_password, verify_password

from ..config import Settings
from ..models import FieldTripClass, FieldTripPost, FieldTripPostAttachment, User
from ..utils import sanitize_plain_text


FIELD_TRIP_MANAGER_ROLES = {'student_council', 'admin'}


class FieldTripError(Exception):
    def __init__(self, message: str, status_code: int = 400, error_code: str | None = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.error_code = error_code


class FastAPIUploadAdapter:
    """
    Adapt FastAPI UploadFile to the Flask-style upload helper interface.
    """

    def __init__(self, upload_file: UploadFile):
        self._upload_file = upload_file
        self.filename = upload_file.filename or ''
        self.mimetype = upload_file.content_type or 'application/octet-stream'
        self.stream = upload_file.file

    def save(self, destination: str):
        self.stream.seek(0)
        with open(destination, 'wb') as output_file:
            shutil.copyfileobj(self.stream, output_file)
        self.stream.seek(0)


def _field_trip_upload_config(settings: Settings) -> dict:
    return settings.field_trip_upload_config


def _build_upload_url(settings: Settings, filename: str) -> str:
    return build_upload_url(_field_trip_upload_config(settings), 'field_trip', filename)


def _guess_mime_from_path(file_path: Path) -> str:
    guessed, _ = mimetypes.guess_type(str(file_path))
    return guessed or 'application/octet-stream'


def _attachment_public_dict(attachment: FieldTripPostAttachment, settings: Settings) -> dict:
    return attachment.to_dict(_build_upload_url(settings, attachment.stored_filename))


def _get_default_board_description(class_label: str) -> str:
    return (
        f'비밀번호를 확인하면 {class_label} 학생들만 현장 기록 글을 확인하고 '
        '작성할 수 있습니다.'
    )


def _resolve_board_description(class_row: FieldTripClass) -> str:
    stored = sanitize_plain_text(class_row.board_description, max_length=240)
    return stored or _get_default_board_description(class_row.label)


def _get_user_role(current_user: User) -> str:
    return str(getattr(current_user, '_jwt_role', None) or current_user.role or '')


def _can_manage_field_trip_post(current_user: User) -> bool:
    return _get_user_role(current_user) in FIELD_TRIP_MANAGER_ROLES


async def _require_class(session: AsyncSession, class_id: str) -> FieldTripClass:
    result = await session.execute(
        select(FieldTripClass).where(FieldTripClass.class_id == str(class_id))
    )
    class_row = result.scalar_one_or_none()
    if not class_row:
        raise FieldTripError('지원하지 않는 반입니다.', 404, 'field_trip_class_not_found')
    return class_row


async def _require_post(
    session: AsyncSession,
    class_id: str,
    post_id: str,
) -> FieldTripPost:
    result = await session.execute(
        select(FieldTripPost)
        .options(selectinload(FieldTripPost.attachments))
        .where(
            FieldTripPost.class_id == str(class_id),
            FieldTripPost.id == str(post_id),
        )
    )
    post = result.scalar_one_or_none()
    if not post:
        raise FieldTripError('게시글을 찾을 수 없습니다.', 404, 'field_trip_post_not_found')
    return post


async def _require_post_editor(post: FieldTripPost, current_user: User) -> None:
    if _can_manage_field_trip_post(current_user):
        return
    if post.author_user_id and int(post.author_user_id) == int(current_user.id):
        return
    raise FieldTripError(
        '게시글을 수정하거나 삭제할 권한이 없습니다.',
        403,
        'field_trip_post_forbidden',
    )


def _normalize_post_payload(
    settings: Settings,
    payload: dict,
) -> tuple[str, str, str, list[dict]]:
    nickname = sanitize_plain_text(
        payload.get('nickname'),
        max_length=settings.FIELD_TRIP_MAX_NICKNAME_LENGTH,
    )
    title = sanitize_plain_text(
        payload.get('title'),
        max_length=settings.FIELD_TRIP_MAX_TITLE_LENGTH,
    )
    body = sanitize_plain_text(
        payload.get('body'),
        max_length=settings.FIELD_TRIP_MAX_BODY_LENGTH,
    )
    attachments_payload = list(payload.get('attachments') or [])

    if not nickname:
        raise FieldTripError('닉네임을 입력해주세요.', 422, 'field_trip_nickname_required')
    if not title:
        raise FieldTripError('제목을 입력해주세요.', 422, 'field_trip_title_required')
    if not body:
        raise FieldTripError('본문을 입력해주세요.', 422, 'field_trip_body_required')
    if len(attachments_payload) > settings.MAX_ATTACH_COUNT:
        raise FieldTripError(
            f'첨부 파일은 최대 {settings.MAX_ATTACH_COUNT}개까지 등록할 수 있습니다.',
            422,
            'field_trip_attachment_count',
        )

    return nickname, title, body, attachments_payload


def _normalize_attachment_payload(
    settings: Settings,
    attachment: dict,
    seen_filenames: set[str],
) -> dict:
    source_url = attachment.get('canonicalUrl') or attachment.get('url')
    filename = extract_upload_filename_for_scope(
        _field_trip_upload_config(settings),
        'field_trip',
        source_url,
    )
    if not filename:
        raise FieldTripError('첨부 파일 URL이 올바르지 않습니다.', 422, 'field_trip_attachment_invalid')

    upload_dir = Path(resolve_scope_upload_dir(_field_trip_upload_config(settings), 'field_trip'))
    file_path = upload_dir / filename
    if not file_path.exists():
        raise FieldTripError(
            '첨부 파일이 서버에 존재하지 않습니다.',
            422,
            'field_trip_attachment_missing',
        )

    if filename in seen_filenames:
        raise FieldTripError(
            '같은 첨부 파일을 중복해서 사용할 수 없습니다.',
            422,
            'field_trip_attachment_duplicate',
        )
    seen_filenames.add(filename)

    kind = sanitize_plain_text(attachment.get('kind'), max_length=16)
    if kind not in {'image', 'file'}:
        raise FieldTripError('첨부 파일 종류가 올바르지 않습니다.', 422, 'field_trip_attachment_kind')

    return {
        'id': sanitize_plain_text(attachment.get('id') or filename, max_length=120) or filename,
        'stored_filename': filename,
        'original_name': sanitize_plain_text(attachment.get('name'), max_length=255) or filename,
        'mime': sanitize_plain_text(attachment.get('mime'), max_length=120)
        or _guess_mime_from_path(file_path),
        'kind': kind,
        'size_bytes': int(attachment.get('size') or 0),
    }


async def _sync_post_attachments(
    session: AsyncSession,
    settings: Settings,
    post: FieldTripPost,
    attachments_payload: list[dict],
) -> list[str]:
    existing_by_filename = {
        attachment.stored_filename: attachment for attachment in list(post.attachments or [])
    }
    retained_filenames: set[str] = set()

    for index, attachment in enumerate(attachments_payload):
        normalized = _normalize_attachment_payload(settings, attachment, retained_filenames)
        existing_attachment = existing_by_filename.get(normalized['stored_filename'])

        if existing_attachment:
            existing_attachment.original_name = normalized['original_name']
            existing_attachment.mime = normalized['mime']
            existing_attachment.kind = normalized['kind']
            existing_attachment.size_bytes = normalized['size_bytes']
            existing_attachment.display_order = index
            continue

        linked_attachment = await session.execute(
            select(FieldTripPostAttachment.id).where(
                FieldTripPostAttachment.stored_filename == normalized['stored_filename']
            )
        )
        if linked_attachment.scalar_one_or_none():
            raise FieldTripError(
                '이미 다른 게시글에 연결된 첨부 파일입니다.',
                422,
                'field_trip_attachment_already_linked',
            )

        session.add(
            FieldTripPostAttachment(
                id=normalized['id'],
                post_id=post.id,
                stored_filename=normalized['stored_filename'],
                original_name=normalized['original_name'],
                mime=normalized['mime'],
                kind=normalized['kind'],
                size_bytes=normalized['size_bytes'],
                display_order=index,
            )
        )

    orphaned_filenames: list[str] = []
    for attachment in list(post.attachments or []):
        if attachment.stored_filename in retained_filenames:
            continue
        orphaned_filenames.append(attachment.stored_filename)
        await session.delete(attachment)

    return orphaned_filenames


async def _remove_orphaned_uploads(
    session: AsyncSession,
    settings: Settings,
    filenames: list[str],
) -> None:
    unique_filenames = {
        str(filename or '').strip()
        for filename in filenames
        if str(filename or '').strip()
    }
    if not unique_filenames:
        return

    upload_dir = Path(resolve_scope_upload_dir(_field_trip_upload_config(settings), 'field_trip'))
    ensure_dir(str(upload_dir))

    for filename in unique_filenames:
        still_linked = await session.execute(
            select(FieldTripPostAttachment.id).where(
                FieldTripPostAttachment.stored_filename == filename
            )
        )
        if still_linked.scalar_one_or_none():
            continue

        file_path = upload_dir / filename
        if file_path.exists():
            try:
                file_path.unlink()
            except OSError:
                continue


async def list_classes(
    session: AsyncSession,
    unlocked_class_ids: set[str],
) -> dict:
    result = await session.execute(
        select(FieldTripClass, func.count(FieldTripPost.id))
        .outerjoin(FieldTripPost, FieldTripPost.class_id == FieldTripClass.class_id)
        .group_by(FieldTripClass.class_id)
        .order_by(cast(FieldTripClass.class_id, Integer))
    )
    items = [
        class_row.to_summary_dict(
            post_count=post_count,
            is_unlocked=class_row.class_id in unlocked_class_ids,
            board_description=_resolve_board_description(class_row),
        )
        for class_row, post_count in result.all()
    ]
    return {'items': items}


async def unlock_class(
    session: AsyncSession,
    class_id: str,
    password: str,
    unlocked_class_ids: set[str],
) -> set[str]:
    class_row = await _require_class(session, class_id)
    normalized_password = sanitize_plain_text(password, max_length=64)
    if not normalized_password or not verify_password(normalized_password, class_row.password_hash):
        raise FieldTripError(
            '비밀번호가 올바르지 않습니다. 다시 확인해 주세요.',
            401,
            'field_trip_invalid_password',
        )

    next_unlocked = set(unlocked_class_ids)
    next_unlocked.add(class_row.class_id)
    return next_unlocked


async def list_posts(
    session: AsyncSession,
    settings: Settings,
    class_id: str,
) -> dict:
    await _require_class(session, class_id)
    result = await session.execute(
        select(FieldTripPost)
        .options(selectinload(FieldTripPost.attachments))
        .where(FieldTripPost.class_id == str(class_id))
        .order_by(FieldTripPost.created_at.desc())
    )
    items = [
        post.to_dict(lambda filename: _build_upload_url(settings, filename))
        for post in result.scalars()
    ]
    return {'items': items}


async def get_post(
    session: AsyncSession,
    settings: Settings,
    class_id: str,
    post_id: str,
) -> dict:
    post = await _require_post(session, class_id, post_id)
    return post.to_dict(lambda filename: _build_upload_url(settings, filename))


async def create_post(
    session: AsyncSession,
    settings: Settings,
    class_id: str,
    payload: dict,
    client_ip: str | None,
    user_agent: str | None,
    current_user: User,
) -> dict:
    await _require_class(session, class_id)
    nickname, title, body, attachments_payload = _normalize_post_payload(settings, payload)

    post = FieldTripPost(
        id=f'field-trip-{class_id}-{uuid.uuid4().hex}',
        class_id=str(class_id),
        author_user_id=current_user.id,
        nickname=nickname,
        title=title,
        body=body,
        ip_address=sanitize_plain_text(client_ip, max_length=64) or None,
        user_agent=sanitize_plain_text(user_agent, max_length=255) or None,
    )
    session.add(post)
    await session.flush()
    await _sync_post_attachments(session, settings, post, attachments_payload)

    try:
        await session.commit()
    except SQLAlchemyError as exc:
        await session.rollback()
        raise FieldTripError('게시글을 저장하지 못했습니다.', 500, 'field_trip_create_failed') from exc

    saved_post = await _require_post(session, class_id, post.id)
    return saved_post.to_dict(lambda filename: _build_upload_url(settings, filename))


async def update_post(
    session: AsyncSession,
    settings: Settings,
    class_id: str,
    post_id: str,
    payload: dict,
    client_ip: str | None,
    user_agent: str | None,
    current_user: User,
) -> dict:
    post = await _require_post(session, class_id, post_id)
    await _require_post_editor(post, current_user)

    nickname, title, body, attachments_payload = _normalize_post_payload(settings, payload)
    post.nickname = nickname
    post.title = title
    post.body = body
    post.ip_address = sanitize_plain_text(client_ip, max_length=64) or post.ip_address
    post.user_agent = sanitize_plain_text(user_agent, max_length=255) or post.user_agent
    orphaned_filenames = await _sync_post_attachments(session, settings, post, attachments_payload)

    try:
        await session.commit()
    except SQLAlchemyError as exc:
        await session.rollback()
        raise FieldTripError('게시글을 저장하지 못했습니다.', 500, 'field_trip_update_failed') from exc

    await _remove_orphaned_uploads(session, settings, orphaned_filenames)
    saved_post = await _require_post(session, class_id, post.id)
    return saved_post.to_dict(lambda filename: _build_upload_url(settings, filename))


async def delete_post(
    session: AsyncSession,
    settings: Settings,
    class_id: str,
    post_id: str,
    current_user: User,
) -> dict:
    post = await _require_post(session, class_id, post_id)
    await _require_post_editor(post, current_user)
    orphaned_filenames = [attachment.stored_filename for attachment in list(post.attachments or [])]

    await session.delete(post)
    try:
        await session.commit()
    except SQLAlchemyError as exc:
        await session.rollback()
        raise FieldTripError('게시글을 삭제하지 못했습니다.', 500, 'field_trip_delete_failed') from exc

    await _remove_orphaned_uploads(session, settings, orphaned_filenames)
    return {'postId': str(post_id), 'deleted': True}


async def upload_file(
    settings: Settings,
    upload_file: UploadFile,
) -> dict:
    adapter = FastAPIUploadAdapter(upload_file)
    config = _field_trip_upload_config(settings)
    result = validate_upload(adapter, config, require_image=False)
    if not result.get('ok'):
        raise FieldTripError(
            result.get('error', '파일 검증에 실패했습니다.'),
            422,
            'field_trip_upload_invalid',
        )

    saved = save_upload_for_scope(adapter, config, 'field_trip')
    return {
        'id': saved['filename'],
        'name': result['name'],
        'size': result['size'],
        'url': build_upload_preview_url(config, 'field_trip', saved['filename']),
        'canonicalUrl': saved['url'],
        'mime': result['mime'],
        'kind': result['kind'],
    }


async def get_upload_delivery(
    session: AsyncSession,
    settings: Settings,
    filename: str,
    preview_token: str,
    unlocked_class_ids: set[str],
) -> dict:
    config = _field_trip_upload_config(settings)
    upload_dir = Path(resolve_scope_upload_dir(config, 'field_trip'))
    ensure_dir(str(upload_dir))
    file_path = upload_dir / filename

    if not file_path.exists():
        raise FieldTripError('첨부 파일을 찾을 수 없습니다.', 404, 'field_trip_upload_not_found')

    result = await session.execute(
        select(FieldTripPostAttachment)
        .options(selectinload(FieldTripPostAttachment.post))
        .where(FieldTripPostAttachment.stored_filename == filename)
    )
    attachment = result.scalar_one_or_none()

    if not attachment:
        if not is_valid_upload_preview_token(config, 'field_trip', filename, preview_token or ''):
            raise FieldTripError(
                '첨부 파일을 찾을 수 없습니다.',
                404,
                'field_trip_upload_not_found',
            )
        media_type = _guess_mime_from_path(file_path)
        return {
            'path': file_path,
            'downloadName': filename,
            'contentDisposition': 'inline' if media_type.startswith('image/') else 'attachment',
            'mediaType': media_type,
        }

    if not attachment.post or attachment.post.class_id not in unlocked_class_ids:
        raise FieldTripError(
            '이 첨부 파일을 보려면 반 비밀번호 확인이 필요합니다.',
            403,
            'field_trip_upload_locked',
        )

    return {
        'path': file_path,
        'downloadName': attachment.original_name or filename,
        'contentDisposition': 'inline' if attachment.kind == 'image' else 'attachment',
        'mediaType': attachment.mime or _guess_mime_from_path(file_path),
    }


async def get_scoreboard(session: AsyncSession) -> dict:
    result = await session.execute(
        select(FieldTripClass).order_by(cast(FieldTripClass.class_id, Integer))
    )
    return {'items': [row.to_score_dict() for row in result.scalars()]}


async def adjust_score(
    session: AsyncSession,
    class_id: str,
    delta: int,
) -> dict:
    class_row = await _require_class(session, class_id)
    current_score = int(class_row.total_score or 0)
    next_score = current_score + int(delta)

    if next_score < 0:
        raise FieldTripError(
            '점수를 0점 미만으로 내릴 수 없습니다.',
            422,
            'field_trip_score_below_minimum',
        )

    if next_score > 10000:
        raise FieldTripError(
            '점수를 10000점 초과로 올릴 수 없습니다.',
            422,
            'field_trip_score_above_maximum',
        )

    class_row.total_score = next_score

    try:
        await session.commit()
    except SQLAlchemyError as exc:
        await session.rollback()
        raise FieldTripError(
            '점수를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.',
            500,
            'field_trip_score_update_failed',
        ) from exc

    return class_row.to_score_dict()


async def update_class_password(
    session: AsyncSession,
    class_id: str,
    password: str,
) -> dict:
    class_row = await _require_class(session, class_id)
    normalized_password = sanitize_plain_text(password, max_length=64)

    if not normalized_password:
        raise FieldTripError(
            '비밀번호를 입력해 주세요.',
            422,
            'field_trip_password_required',
        )

    if len(normalized_password) < 4:
        raise FieldTripError(
            '비밀번호는 4자 이상 입력해 주세요.',
            422,
            'field_trip_password_too_short',
        )

    class_row.password_hash = hash_password(normalized_password)

    try:
        await session.commit()
    except SQLAlchemyError as exc:
        await session.rollback()
        raise FieldTripError(
            '비밀번호를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.',
            500,
            'field_trip_password_update_failed',
        ) from exc

    return {
        'classId': class_row.class_id,
        'label': class_row.label,
        'passwordUpdated': True,
    }


async def update_board_description(
    session: AsyncSession,
    class_id: str,
    board_description: str,
) -> dict:
    class_row = await _require_class(session, class_id)
    normalized_description = sanitize_plain_text(board_description, max_length=240) or None
    class_row.board_description = normalized_description

    try:
        await session.commit()
    except SQLAlchemyError as exc:
        await session.rollback()
        raise FieldTripError(
            '게시판 설명을 저장하지 못했습니다.',
            500,
            'field_trip_board_description_update_failed',
        ) from exc

    return {
        'classId': class_row.class_id,
        'label': class_row.label,
        'boardDescription': _resolve_board_description(class_row),
    }


async def update_scoreboard(
    session: AsyncSession,
    rows: list[dict],
) -> dict:
    if not rows:
        raise FieldTripError('rows가 비어 있습니다.', 422, 'field_trip_score_rows_required')

    unique_class_ids = {str(row.get('classId') or '').strip() for row in rows}
    if '' in unique_class_ids or len(unique_class_ids) != len(rows):
        raise FieldTripError(
            '점수판 반 정보가 올바르지 않습니다.',
            422,
            'field_trip_score_rows_invalid',
        )

    result = await session.execute(
        select(FieldTripClass).where(FieldTripClass.class_id.in_(unique_class_ids))
    )
    class_rows = {row.class_id: row for row in result.scalars()}
    if len(class_rows) != len(unique_class_ids):
        raise FieldTripError('지원하지 않는 반이 포함되어 있습니다.', 404, 'field_trip_class_not_found')

    for row in rows:
        class_id = str(row.get('classId'))
        class_rows[class_id].total_score = int(row.get('totalScore') or 0)

    try:
        await session.commit()
    except SQLAlchemyError as exc:
        await session.rollback()
        raise FieldTripError('점수판을 저장하지 못했습니다.', 500, 'field_trip_score_update_failed') from exc

    return await get_scoreboard(session)
