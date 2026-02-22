"""
Notice, attachment, comment, and reaction routes.
"""
from datetime import datetime, timedelta, timezone
from pathlib import Path
import re
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from flask import Blueprint, request, jsonify, current_app, send_from_directory
from flask_jwt_extended import (
    jwt_required,
    get_jwt_identity,
    verify_jwt_in_request,
)
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import or_
from sqlalchemy.orm import joinedload, selectinload

from models import (
    db,
    Notice,
    Attachment,
    NoticeCategory,
    User,
    UserRole,
    Comment,
    NoticeReaction,
    ReactionType,
    CountdownEvent,
)
from utils.pagination import parse_pagination, build_paginated_response
from utils.files import (
    save_upload_for_scope,
    resolve_scope_upload_dir,
    ensure_dir,
    validate_upload,
    build_upload_url,
    normalize_upload_url_for_scope,
)
from utils.security import require_role, get_current_user
from utils.cache import cache_json_response, invalidate_cache_namespaces

notices_bp = Blueprint('notices', __name__, url_prefix='/api/notices')


def resolve_kst_timezone():
    """Resolve Asia/Seoul timezone with fixed-offset fallback."""
    try:
        return ZoneInfo('Asia/Seoul')
    except ZoneInfoNotFoundError:
        return timezone(timedelta(hours=9))


KST = resolve_kst_timezone()


def parse_bool(val):
    """Parse permissive boolean query flags."""
    if val is None:
        return None
    return str(val).lower() in {'1', 'true', 'yes', 'on'}


def parse_tags(value):
    """Normalize tag inputs from string/list payload forms."""
    if value is None:
        return []

    if isinstance(value, str):
        raw_items = re.split(r'[,\n;，]+', value)
    elif isinstance(value, (list, tuple, set)):
        raw_items = []
        for item in value:
            raw_items.extend(re.split(r'[,\n;，]+', str(item or '')))
    else:
        raw_items = re.split(r'[,\n;，]+', str(value))

    normalized = []
    seen = set()
    for item in raw_items:
        tag = item.strip()
        if not tag:
            continue
        if tag in seen:
            continue
        normalized.append(tag)
        seen.add(tag)
    return normalized[:30]


def optional_current_user_id():
    """
    Return current user id if JWT is present; otherwise None.
    Uses optional verification to avoid raising for anonymous requests.
    """
    try:
        verify_jwt_in_request(optional=True)
        user_id_str = get_jwt_identity()
        return int(user_id_str) if user_id_str else None
    except Exception:
        return None


def get_next_countdown_event():
    """Return next upcoming countdown event serialized for notice list payload."""
    now_kst_naive = datetime.now(KST).replace(tzinfo=None)
    event = (
        CountdownEvent.query
        .filter(CountdownEvent.event_at >= now_kst_naive)
        .order_by(CountdownEvent.event_at.asc(), CountdownEvent.id.asc())
        .first()
    )
    return event.to_dict() if event else None


@notices_bp.route('/', methods=['GET'])
@notices_bp.route('', methods=['GET'])
@cache_json_response('notices')
def list_notices():
    """
    List notices with category/tag filters and optional reaction metadata.

    Countdown event metadata is attached for school notice views.
    """
    category = request.args.get('category')
    query_text = request.args.get('query')
    pinned = parse_bool(request.args.get('pinned'))
    important = parse_bool(request.args.get('important'))
    exam = parse_bool(request.args.get('exam'))
    sort = request.args.get('sort', 'recent')
    tags = request.args.get('tags')
    view = request.args.get('view')
    page, page_size = parse_pagination(request)

    q = Notice.query.options(
        joinedload(Notice.author),
        selectinload(Notice.attachments),
    )
    q = apply_filters(q, category, query_text, pinned, important, exam, tags)
    total = q.count()
    q = apply_sort(q, sort)
    items = q.offset((page - 1) * page_size).limit(page_size).all()

    current_user_id = optional_current_user_id()
    reactions_map = {}
    if current_user_id:
        notice_ids = [n.id for n in items]
        if notice_ids:
            reactions = NoticeReaction.query.filter(
                NoticeReaction.user_id == current_user_id,
                NoticeReaction.notice_id.in_(notice_ids)
            ).all()
            reactions_map = {r.notice_id: r.type.value for r in reactions}

    extra = None
    if category in {NoticeCategory.SCHOOL.value, NoticeCategory.SCHOOL}:
        extra = {'countdownEvent': get_next_countdown_event()}

    return jsonify(
        build_paginated_response(
            [
                n.to_list_dict(my_reaction=reactions_map.get(n.id))
                if view == 'list'
                else n.to_dict(my_reaction=reactions_map.get(n.id))
                for n in items
            ],
            total,
            page,
            page_size,
            extra=extra,
        )
    )


def apply_filters(query, category, query_text, pinned, important, exam, tags=None):
    """Apply notice filters while always excluding soft-deleted rows."""
    if category in {NoticeCategory.SCHOOL.value, NoticeCategory.SCHOOL}:
        query = query.filter(Notice.category == NoticeCategory.SCHOOL)
    elif category in {NoticeCategory.COUNCIL.value, NoticeCategory.COUNCIL}:
        query = query.filter(Notice.category == NoticeCategory.COUNCIL)

    if pinned is not None:
        query = query.filter(Notice.pinned.is_(pinned))
    if important is not None:
        query = query.filter(Notice.important.is_(important))
    if exam is not None:
        query = query.filter(Notice.exam_related.is_(exam))

    if query_text:
        pattern = f"%{query_text}%"
        query = query.filter(
            or_(
                Notice.title.ilike(pattern),
                Notice.body.ilike(pattern),
                Notice.summary.ilike(pattern),
                Notice.tags.ilike(pattern),
            )
        )
    if tags:
        tags_list = parse_tags(tags)
        for tag in tags_list:
            query = query.filter(Notice.tags.ilike(f"%{tag}%"))
    query = query.filter(Notice.deleted_at.is_(None))
    return query


def apply_sort(query, sort):
    """Apply supported sort key for notice listing."""
    if sort == 'views':
        return query.order_by(Notice.pinned.desc(), Notice.views.desc(), Notice.created_at.desc())
    if sort == 'important':
        return query.order_by(Notice.pinned.desc(), Notice.important.desc(), Notice.created_at.desc())
    return query.order_by(Notice.pinned.desc(), Notice.created_at.desc())


def validate_notice_payload(data, is_update=False):
    """Validate notice payload and normalize attachment/tag fields."""
    errors = []
    title = (data.get('title') or '').strip()
    body = (data.get('body') or '').strip()
    category = data.get('category')
    tags = parse_tags(data.get('tags'))
    pinned = bool(data.get('pinned', False))
    important = bool(data.get('important', False))
    exam_related = bool(data.get('examRelated', False))
    attachments = data.get('attachments') or []

    if not title or len(title) < 2 or len(title) > 200:
        errors.append('제목은 2~200자로 입력해주세요.')
    if not body:
        errors.append('본문은 필수입니다.')
    if category not in (NoticeCategory.SCHOOL.value, NoticeCategory.COUNCIL.value):
        errors.append('category는 school 또는 council 이어야 합니다.')

    max_attach = current_app.config.get('MAX_ATTACH_COUNT', 5)
    max_size = current_app.config.get('MAX_ATTACH_SIZE', 10 * 1024 * 1024)
    if len(attachments) > max_attach:
        errors.append(f'첨부파일은 최대 {max_attach}개까지 가능합니다.')
    normalized_attachments = []
    for a in attachments:
        if not isinstance(a, dict):
            errors.append('첨부파일 형식이 올바르지 않습니다.')
            continue

        attachment_url = normalize_upload_url_for_scope(current_app.config, 'notices', a.get('url'))
        if not attachment_url:
            errors.append('첨부파일 URL이 올바르지 않습니다.')
            continue

        try:
            file_size = int(a.get('size') or 0)
        except (TypeError, ValueError):
            file_size = 0
        if file_size > max_size:
            errors.append(f'첨부파일 용량은 10MB 이하만 가능합니다.')
            continue

        normalized_attachments.append(
            {
                'name': a.get('name'),
                'url': attachment_url,
                'mime': a.get('mime'),
                'size': file_size or None,
                'kind': a.get('kind', 'file'),
            }
        )

    return errors, {
        'title': title,
        'body': body,
        'category': category,
        'tags': tags,
        'pinned': pinned,
        'important': important,
        'exam_related': exam_related,
        'attachments': normalized_attachments,
    }


def map_category(cat_str):
    """Map raw category string to enum with school as fallback."""
    if cat_str == NoticeCategory.COUNCIL.value:
        return NoticeCategory.COUNCIL
    return NoticeCategory.SCHOOL


@notices_bp.route('/', methods=['POST'])
@notices_bp.route('', methods=['POST'])
@jwt_required()
@require_role(UserRole.STUDENT_COUNCIL, UserRole.ADMIN)
def create_notice():
    """Create notice (student-council/admin only)."""
    data = request.get_json() or {}
    errors, payload = validate_notice_payload(data)
    if errors:
        return jsonify({'errors': errors}), 422

    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404

    notice = Notice(
        category=map_category(payload['category']),
        title=payload['title'],
        body=payload['body'],
        summary=data.get('summary') or Notice.summarize(payload['body']),
        pinned=payload['pinned'],
        important=payload['important'],
        exam_related=payload['exam_related'],
        tags=','.join(payload['tags']),
        author_id=user.id,
        author_role=user.role.value,
    )

    for a in payload['attachments']:
        notice.attachments.append(
            Attachment(
                name=a.get('name'),
                url=a.get('url'),
                mime=a.get('mime'),
                size=a.get('size'),
                kind=a.get('kind', 'file'),
            )
        )

    try:
        db.session.add(notice)
        db.session.commit()
        invalidate_cache_namespaces('notices')
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '공지 저장 중 오류가 발생했습니다.'}), 500

    return jsonify(notice.to_dict()), 201


def ensure_edit_permission(notice, user):
    """Student council can edit own notices; admin can edit any notice."""
    if user.role == UserRole.ADMIN:
        return True
    if user.role == UserRole.STUDENT_COUNCIL and notice.author_id == user.id:
        return True
    return False


@notices_bp.route('/<int:notice_id>', methods=['PUT'])
@jwt_required()
def update_notice(notice_id):
    """Update notice and replace attachment set atomically."""
    notice = Notice.query.get(notice_id)
    if not notice:
        return jsonify({'error': '공지 를 찾을 수 없습니다.'}), 404
    if notice.deleted_at:
        return jsonify({'error': '삭제된 공지입니다.'}), 404

    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404

    if not ensure_edit_permission(notice, user):
        return jsonify({'error': '수정 권한이 없습니다.'}), 403

    data = request.get_json() or {}
    errors, payload = validate_notice_payload(data, is_update=True)
    if errors:
        return jsonify({'errors': errors}), 422

    notice.title = payload['title']
    notice.body = payload['body']
    notice.summary = data.get('summary') or Notice.summarize(payload['body'])
    notice.category = map_category(payload['category'])
    notice.pinned = payload['pinned']
    notice.important = payload['important']
    notice.exam_related = payload['exam_related']
    notice.tags = ','.join(payload['tags'])

    # Replace attachments
    notice.attachments = []
    for a in payload['attachments']:
        notice.attachments.append(
            Attachment(
                name=a.get('name'),
                url=a.get('url'),
                mime=a.get('mime'),
                size=a.get('size'),
                kind=a.get('kind', 'file'),
            )
        )

    try:
        db.session.commit()
        invalidate_cache_namespaces('notices')
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '공지 수정 중 오류가 발생했습니다.'}), 500

    return jsonify(notice.to_dict())


@notices_bp.route('/<int:notice_id>', methods=['DELETE'])
@jwt_required()
def delete_notice(notice_id):
    """Soft-delete notice when caller has edit permission."""
    notice = Notice.query.get(notice_id)
    if not notice:
        return jsonify({'error': '공지 를 찾을 수 없습니다.'}), 404

    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404

    if not ensure_edit_permission(notice, user):
        return jsonify({'error': '삭제 권한이 없습니다.'}), 403

    try:
        notice.deleted_at = db.func.now()
        db.session.commit()
        invalidate_cache_namespaces('notices')
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '공지 삭제 중 오류가 발생했습니다.'}), 500

    return jsonify({'message': '삭제되었습니다.'}), 200


@notices_bp.route('/<int:notice_id>', methods=['GET'])
def get_notice(notice_id):
    """Return notice detail and best-effort increment view counter."""
    notice = Notice.query.options(
        joinedload(Notice.author),
        selectinload(Notice.attachments),
    ).filter_by(id=notice_id).first()
    if not notice:
        return jsonify({'error': '공지 를 찾을 수 없습니다.'}), 404
    if notice.deleted_at:
        return jsonify({'error': '삭제된 공지입니다.'}), 404

    current_user_id = optional_current_user_id()
    my_reaction = None
    if current_user_id:
        reaction = NoticeReaction.query.filter_by(
            notice_id=notice_id,
            user_id=current_user_id
        ).first()
        if reaction:
            my_reaction = reaction.type.value

    # Increment views (best-effort)
    try:
        notice.views += 1
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()

    return jsonify(notice.to_dict(my_reaction=my_reaction))


@notices_bp.route('/uploads', methods=['POST'])
@notices_bp.route('/uploads/', methods=['POST'])
@jwt_required()
@require_role(UserRole.STUDENT_COUNCIL, UserRole.ADMIN)
def upload_file():
    """Validate and store notice attachment file."""
    if 'file' not in request.files:
        return jsonify({'error': 'file 필드가 필요합니다.'}), 400
    file = request.files['file']

    result = validate_upload(file, current_app.config, require_image=False)
    if not result.get('ok'):
        return jsonify({'error': result.get('error', '파일 검증에 실패했습니다.')}), 422

    saved = save_upload_for_scope(file, current_app.config, 'notices')

    return jsonify({
        'id': saved['filename'],
        'name': result['name'],
        'size': result['size'],
        'url': saved['url'],
        'mime': result['mime'],
        'kind': result['kind'],
    }), 201


@notices_bp.route('/uploads/<path:filename>', methods=['GET'], strict_slashes=False)
def serve_upload(filename):
    """
    Serve notice uploads with compatibility fallbacks.

    Newly uploaded files can be previewed before notice linkage is saved.
    """
    upload_dir = resolve_scope_upload_dir(current_app.config, 'notices')
    ensure_dir(upload_dir)
    file_path = Path(upload_dir) / filename
    attachment_url = build_upload_url(current_app.config, 'notices', filename)
    attachment = Attachment.query.filter_by(url=attachment_url).first()
    if not attachment:
        # Backward compatibility for rows that stored absolute URLs.
        attachment = Attachment.query.filter(Attachment.url.like(f'%{attachment_url}')).first()

    notice = attachment.notice if attachment else None
    if not notice:
        # Inline editor images can exist only in body HTML (without attachment rows).
        notice = Notice.query.filter(
            Notice.deleted_at.is_(None),
            Notice.body.ilike(f'%{attachment_url}%')
        ).first()
    if not notice:
        if not file_path.exists():
            return jsonify({'error': '첨부파일을 찾을 수 없습니다.'}), 404
        # Allow temporary preview/download for newly uploaded files before notice save.
        ext = Path(filename).suffix.lower()
        inline_exts = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}
        response = send_from_directory(
            upload_dir,
            filename,
            as_attachment=ext not in inline_exts,
            download_name=filename,
        )
        response.headers['X-Content-Type-Options'] = 'nosniff'
        return response

    ext = Path(filename).suffix.lower()
    inline_exts = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}
    download_name = attachment.name if attachment and attachment.name else filename
    inline_mime = (attachment.mime or '').startswith('image/') if attachment else ext in inline_exts
    response = send_from_directory(
        upload_dir,
        filename,
        as_attachment=not inline_mime,
        download_name=download_name
    )
    response.headers['X-Content-Type-Options'] = 'nosniff'
    return response


# ----- Comments -----


@notices_bp.route('/<int:notice_id>/comments', methods=['GET'])
@cache_json_response('notices')
def list_comments(notice_id):
    """List notice comments with deterministic ordering and pagination."""
    notice = Notice.query.get(notice_id)
    if not notice or notice.deleted_at:
        return jsonify({'error': '공지 를 찾을 수 없습니다.'}), 404

    page, page_size = parse_pagination(request)
    order = request.args.get('order', 'asc')
    q = Comment.query.options(
        joinedload(Comment.user),
    ).filter(
        Comment.notice_id == notice_id,
        Comment.deleted_at.is_(None)
    )
    total = q.count()
    if order == 'desc':
        q = q.order_by(Comment.created_at.desc())
    else:
        q = q.order_by(Comment.created_at.asc())
    items = q.offset((page - 1) * page_size).limit(page_size).all()

    return jsonify(
        build_paginated_response(
            [c.to_dict() for c in items],
            total,
            page,
            page_size,
        )
    )


@notices_bp.route('/<int:notice_id>/comments', methods=['POST'])
@jwt_required()
def create_comment(notice_id):
    """Create one notice comment for authenticated user."""
    notice = Notice.query.get(notice_id)
    if not notice or notice.deleted_at:
        return jsonify({'error': '공지 를 찾을 수 없습니다.'}), 404

    data = request.get_json() or {}
    body = (data.get('body') or '').strip()
    if not body or len(body) < 1 or len(body) > 1000:
        return jsonify({'error': '댓글은 1~1000자로 입력해주세요.'}), 422

    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404

    comment = Comment(
        notice_id=notice_id,
        user_id=user.id,
        body=body
    )

    try:
        db.session.add(comment)
        db.session.commit()
        invalidate_cache_namespaces('notices')
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '댓글 작성 중 오류가 발생했습니다.'}), 500

    return jsonify(comment.to_dict()), 201


@notices_bp.route('/<int:notice_id>/comments/<int:comment_id>', methods=['DELETE'])
@jwt_required()
@require_role(UserRole.ADMIN)
def delete_comment(notice_id, comment_id):
    """Soft-delete notice comment (admin only)."""
    comment = Comment.query.filter_by(id=comment_id, notice_id=notice_id).first()
    if not comment or comment.deleted_at:
        return jsonify({'error': '댓글을 찾을 수 없습니다.'}), 404

    try:
        comment.deleted_at = db.func.now()
        db.session.commit()
        invalidate_cache_namespaces('notices')
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '댓글 삭제 중 오류가 발생했습니다.'}), 500

    return jsonify({'message': '삭제되었습니다.'}), 200


# ----- Reactions -----


@notices_bp.route('/<int:notice_id>/reactions', methods=['POST'])
@jwt_required()
def react_notice(notice_id):
    """Toggle/switch reaction and maintain denormalized like/dislike counters."""
    notice = Notice.query.get(notice_id)
    if not notice or notice.deleted_at:
        return jsonify({'error': '공지 를 찾을 수 없습니다.'}), 404

    data = request.get_json() or {}
    reaction_type = data.get('type')
    if reaction_type not in (ReactionType.LIKE.value, ReactionType.DISLIKE.value):
        return jsonify({'error': 'type은 like 또는 dislike 이어야 합니다.'}), 422

    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404

    existing = NoticeReaction.query.filter_by(
        notice_id=notice_id,
        user_id=user.id
    ).first()

    try:
        if existing and existing.type.value == reaction_type:
            # Toggle off
            if reaction_type == ReactionType.LIKE.value and notice.like_count > 0:
                notice.like_count -= 1
            if reaction_type == ReactionType.DISLIKE.value and notice.dislike_count > 0:
                notice.dislike_count -= 1
            db.session.delete(existing)
            my_reaction = None
        else:
            # Switch or add
            if existing:
                if existing.type == ReactionType.LIKE and notice.like_count > 0:
                    notice.like_count -= 1
                if existing.type == ReactionType.DISLIKE and notice.dislike_count > 0:
                    notice.dislike_count -= 1
                existing.type = ReactionType(reaction_type)
                my_reaction = reaction_type
            else:
                new_reaction = NoticeReaction(
                    notice_id=notice_id,
                    user_id=user.id,
                    type=ReactionType(reaction_type)
                )
                db.session.add(new_reaction)
                my_reaction = reaction_type

            if reaction_type == ReactionType.LIKE.value:
                notice.like_count += 1
            else:
                notice.dislike_count += 1

        db.session.commit()
        invalidate_cache_namespaces('notices')
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '리액션 처리 중 오류가 발생했습니다.'}), 500

    return jsonify({
        'likes': notice.like_count,
        'dislikes': notice.dislike_count,
        'myReaction': my_reaction
    })
