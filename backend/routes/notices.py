"""
Notice, attachment, comment, reaction, and budget settings routes.
"""
from datetime import datetime, timedelta, timezone
from pathlib import Path
import re
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from flask import Blueprint, request, jsonify, current_app, send_from_directory
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from sqlalchemy import or_
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import joinedload, selectinload

from models import (
    db,
    Notice,
    Attachment,
    NoticeCategory,
    UserRole,
    Comment,
    NoticeReaction,
    ReactionType,
    CountdownEvent,
)
from utils.pagination import parse_pagination, build_paginated_response
from utils.files import (
    build_upload_preview_url,
    canonicalize_upload_urls_in_text,
    save_upload_for_scope,
    resolve_scope_upload_dir,
    ensure_dir,
    is_valid_upload_preview_token,
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
# Keep the API-owned month order aligned with the frontend guard logic.
BUDGET_MONTH_ORDER = ['03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '01', '02']


def parse_bool(value):
    """Parse permissive boolean query flags."""
    if value is None:
        return None
    return str(value).strip().lower() in {'1', 'true', 'yes', 'on'}


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
        if not tag or tag in seen:
            continue
        normalized.append(tag)
        seen.add(tag)
    return normalized[:30]


def parse_budget_year(value):
    """Parse budget year integer from query/body inputs."""
    if value in (None, ''):
        return None
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return None


def parse_budget_month(value):
    """Parse budget month integer from query/body inputs."""
    if value in (None, ''):
        return None
    raw = str(value).strip()
    if not raw.isdigit():
        return None
    month = int(raw)
    if month < 1 or month > 12:
        return None
    return month


def format_budget_month(month):
    """Serialize month integer as zero-padded month string."""
    return str(int(month)).zfill(2)


def get_budget_board_year_range():
    """Return inclusive active budget board year range from config."""
    return (
        int(current_app.config.get('BUDGET_BOARD_START_YEAR')),
        int(current_app.config.get('BUDGET_BOARD_END_YEAR')),
    )


def get_current_budget_cycle(now=None):
    """Return current budget cycle year/month in KST."""
    current_time = now or datetime.now(KST)
    if current_time.tzinfo is None:
        current_time = current_time.replace(tzinfo=KST)
    else:
        current_time = current_time.astimezone(KST)
    budget_year = current_time.year if current_time.month >= 3 else current_time.year - 1
    return budget_year, format_budget_month(current_time.month)


def clamp_budget_year(year_value, start_year, end_year):
    """Clamp year_value into inclusive active budget year range."""
    return max(start_year, min(end_year, year_value))


def build_budget_settings_payload():
    """Return backend-owned budget board settings for the frontend."""
    start_year, end_year = get_budget_board_year_range()
    current_budget_year, current_budget_month = get_current_budget_cycle()
    default_budget_year = clamp_budget_year(current_budget_year, start_year, end_year)
    return {
        'startYear': start_year,
        'endYear': end_year,
        'monthOrder': BUDGET_MONTH_ORDER,
        'currentBudgetYear': current_budget_year,
        'currentBudgetMonth': current_budget_month,
        'defaultBudgetYear': default_budget_year,
        'defaultBudgetMonth': current_budget_month,
    }


def validate_budget_year_range(year_value, errors, field_label='budgetYear'):
    """Append validation error when a budget year falls outside active config range."""
    if year_value is None:
        return
    start_year, end_year = get_budget_board_year_range()
    if year_value < start_year or year_value > end_year:
        errors.append(f'{field_label} must be between {start_year} and {end_year}.')


def is_active_budget_notice(notice):
    """Return True when budget notice belongs to current active year range."""
    if notice.category != NoticeCategory.BUDGET:
        return True
    if notice.budget_year is None or notice.budget_month is None:
        return False
    if notice.budget_month < 1 or notice.budget_month > 12:
        return False
    start_year, end_year = get_budget_board_year_range()
    return start_year <= notice.budget_year <= end_year


def abort_if_inactive_budget_notice(notice):
    """Return 404 when a budget notice falls outside the active board window."""
    if not is_active_budget_notice(notice):
        return jsonify({'error': 'Budget notice not found'}), 404
    return None


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
        CountdownEvent.query.filter(CountdownEvent.event_at >= now_kst_naive)
        .order_by(CountdownEvent.event_at.asc(), CountdownEvent.id.asc())
        .first()
    )
    return event.to_dict() if event else None


def apply_filters(
    query,
    category,
    query_text,
    pinned,
    important,
    exam,
    tags=None,
    budget_year=None,
    budget_month=None,
):
    """Apply notice filters while always excluding soft-deleted rows."""
    if category in {NoticeCategory.SCHOOL.value, NoticeCategory.SCHOOL}:
        query = query.filter(Notice.category == NoticeCategory.SCHOOL)
    elif category in {NoticeCategory.COUNCIL.value, NoticeCategory.COUNCIL}:
        query = query.filter(Notice.category == NoticeCategory.COUNCIL)
    elif category in {NoticeCategory.BUDGET.value, NoticeCategory.BUDGET}:
        query = query.filter(Notice.category == NoticeCategory.BUDGET)
        if budget_year is not None:
            query = query.filter(Notice.budget_year == budget_year)
        if budget_month is not None:
            query = query.filter(Notice.budget_month == budget_month)

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
        for tag in parse_tags(tags):
            query = query.filter(Notice.tags.ilike(f"%{tag}%"))
    return query.filter(Notice.deleted_at.is_(None))


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
    body = canonicalize_upload_urls_in_text(current_app.config, 'notices', body)
    category = data.get('category')
    tags = parse_tags(data.get('tags'))
    pinned = bool(data.get('pinned', False))
    important = bool(data.get('important', False))
    exam_related = bool(data.get('examRelated', False))
    attachments = data.get('attachments') or []

    budget_year = None
    budget_month = None
    if category == NoticeCategory.BUDGET.value:
        budget_year = parse_budget_year(data.get('budgetYear', data.get('budget_year')))
        budget_month = parse_budget_month(data.get('budgetMonth', data.get('budget_month')))

    if not title or len(title) < 2 or len(title) > 200:
        errors.append('Title must be between 2 and 200 characters.')
    if not body:
        errors.append('Body is required.')
    if category not in (
        NoticeCategory.SCHOOL.value,
        NoticeCategory.COUNCIL.value,
        NoticeCategory.BUDGET.value,
    ):
        errors.append('category must be one of school, council, or budget.')

    if category == NoticeCategory.BUDGET.value:
        if budget_year is None:
            errors.append('budgetYear is required for budget notices.')
        else:
            validate_budget_year_range(budget_year, errors, field_label='budgetYear')
        if budget_month is None:
            errors.append('budgetMonth must be a month between 01 and 12 for budget notices.')
        # Budget disclosure posts reuse the notice table but deliberately opt out
        # of legacy notice affordances such as pins, importance flags, exams,
        # and tags so every monthly entry renders with one consistent shape.
        tags = []
        pinned = False
        important = False
        exam_related = False

    max_attach = current_app.config.get('MAX_ATTACH_COUNT', 5)
    max_size = current_app.config.get('MAX_ATTACH_SIZE', 10 * 1024 * 1024)
    if len(attachments) > max_attach:
        errors.append(f'Attachments are limited to {max_attach} files.')

    normalized_attachments = []
    for attachment in attachments:
        if not isinstance(attachment, dict):
            errors.append('Attachment payload must be an object.')
            continue

        attachment_url = normalize_upload_url_for_scope(
            current_app.config,
            'notices',
            attachment.get('url'),
        )
        if not attachment_url:
            errors.append('Attachment URL is invalid.')
            continue

        try:
            file_size = int(attachment.get('size') or 0)
        except (TypeError, ValueError):
            file_size = 0

        if file_size > max_size:
            errors.append('Attachment size exceeds the allowed limit.')
            continue

        normalized_attachments.append(
            {
                'name': attachment.get('name'),
                'url': attachment_url,
                'mime': attachment.get('mime'),
                'size': file_size or None,
                'kind': attachment.get('kind', 'file'),
            }
        )

    return errors, {
        'title': title,
        'body': body,
        'category': category,
        'budget_year': budget_year,
        'budget_month': budget_month,
        'tags': tags,
        'pinned': pinned,
        'important': important,
        'exam_related': exam_related,
        'attachments': normalized_attachments,
    }


def map_category(category_raw):
    """Map raw category string to enum with school as fallback."""
    if category_raw == NoticeCategory.COUNCIL.value:
        return NoticeCategory.COUNCIL
    if category_raw == NoticeCategory.BUDGET.value:
        return NoticeCategory.BUDGET
    return NoticeCategory.SCHOOL


def ensure_edit_permission(notice, user):
    """Student council can edit own notices; admin can edit any notice."""
    if user.role == UserRole.ADMIN:
        return True
    if user.role == UserRole.STUDENT_COUNCIL and notice.author_id == user.id:
        return True
    return False


@notices_bp.route('/budget/settings', methods=['GET'])
@cache_json_response('notices')
def get_budget_settings():
    """Return backend-owned budget board settings for the frontend."""
    return jsonify(build_budget_settings_payload())


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

    budget_year = None
    budget_month = None
    if category == NoticeCategory.BUDGET.value:
        budget_year = parse_budget_year(request.args.get('budgetYear', request.args.get('budget_year')))
        budget_month = parse_budget_month(request.args.get('budgetMonth', request.args.get('budget_month')))
        validation_errors = []
        if budget_year is None:
            validation_errors.append('budgetYear is required for budget notice listing.')
        else:
            validate_budget_year_range(budget_year, validation_errors, field_label='budgetYear')
        if budget_month is None:
            validation_errors.append('budgetMonth must be a month between 01 and 12 for budget notice listing.')
        if validation_errors:
            return jsonify({'errors': validation_errors}), 422

    query = Notice.query.options(
        joinedload(Notice.author),
        selectinload(Notice.attachments),
    )
    query = apply_filters(
        query,
        category,
        query_text,
        pinned,
        important,
        exam,
        tags,
        budget_year=budget_year,
        budget_month=budget_month,
    )
    total = query.count()
    query = apply_sort(query, sort)
    items = query.offset((page - 1) * page_size).limit(page_size).all()

    current_user_id = optional_current_user_id()
    reactions_map = {}
    if current_user_id and items:
        notice_ids = [notice.id for notice in items]
        reactions = NoticeReaction.query.filter(
            NoticeReaction.user_id == current_user_id,
            NoticeReaction.notice_id.in_(notice_ids),
        ).all()
        reactions_map = {reaction.notice_id: reaction.type.value for reaction in reactions}

    extra = None
    if category in {NoticeCategory.SCHOOL.value, NoticeCategory.SCHOOL}:
        extra = {'countdownEvent': get_next_countdown_event()}

    serialized_items = [
        notice.to_list_dict(my_reaction=reactions_map.get(notice.id))
        if view == 'list'
        else notice.to_dict(my_reaction=reactions_map.get(notice.id))
        for notice in items
    ]

    return jsonify(
        build_paginated_response(
            serialized_items,
            total,
            page,
            page_size,
            extra=extra,
        )
    )


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
        budget_year=payload['budget_year'],
        budget_month=payload['budget_month'],
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

    for attachment in payload['attachments']:
        notice.attachments.append(
            Attachment(
                name=attachment.get('name'),
                url=attachment.get('url'),
                mime=attachment.get('mime'),
                size=attachment.get('size'),
                kind=attachment.get('kind', 'file'),
            )
        )

    try:
        db.session.add(notice)
        db.session.commit()
        invalidate_cache_namespaces('notices')
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': 'Failed to create notice.'}), 500

    return jsonify(notice.to_dict()), 201


@notices_bp.route('/<int:notice_id>', methods=['PUT'])
@jwt_required()
def update_notice(notice_id):
    """Update notice and replace attachment set atomically."""
    notice = Notice.query.get(notice_id)
    if not notice or notice.deleted_at:
        return jsonify({'error': 'Notice not found.'}), 404

    inactive_budget_response = abort_if_inactive_budget_notice(notice)
    if inactive_budget_response:
        return inactive_budget_response

    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    if not ensure_edit_permission(notice, user):
        return jsonify({'error': 'Insufficient permissions.'}), 403

    data = request.get_json() or {}
    errors, payload = validate_notice_payload(data, is_update=True)
    if errors:
        return jsonify({'errors': errors}), 422

    notice.category = map_category(payload['category'])
    notice.budget_year = payload['budget_year']
    notice.budget_month = payload['budget_month']
    notice.title = payload['title']
    notice.body = payload['body']
    notice.summary = data.get('summary') or Notice.summarize(payload['body'])
    notice.pinned = payload['pinned']
    notice.important = payload['important']
    notice.exam_related = payload['exam_related']
    notice.tags = ','.join(payload['tags'])

    notice.attachments = []
    for attachment in payload['attachments']:
        notice.attachments.append(
            Attachment(
                name=attachment.get('name'),
                url=attachment.get('url'),
                mime=attachment.get('mime'),
                size=attachment.get('size'),
                kind=attachment.get('kind', 'file'),
            )
        )

    try:
        db.session.commit()
        invalidate_cache_namespaces('notices')
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': 'Failed to update notice.'}), 500

    return jsonify(notice.to_dict())


@notices_bp.route('/<int:notice_id>', methods=['DELETE'])
@jwt_required()
def delete_notice(notice_id):
    """Soft-delete notice when caller has edit permission."""
    notice = Notice.query.get(notice_id)
    if not notice:
        return jsonify({'error': 'Notice not found.'}), 404

    inactive_budget_response = abort_if_inactive_budget_notice(notice)
    if inactive_budget_response:
        return inactive_budget_response

    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    if not ensure_edit_permission(notice, user):
        return jsonify({'error': 'Insufficient permissions.'}), 403

    try:
        notice.deleted_at = db.func.now()
        db.session.commit()
        invalidate_cache_namespaces('notices')
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': 'Failed to delete notice.'}), 500

    return jsonify({'message': 'Notice deleted.'}), 200


@notices_bp.route('/<int:notice_id>', methods=['GET'])
def get_notice(notice_id):
    """Return notice detail and best-effort increment view counter."""
    notice = (
        Notice.query.options(joinedload(Notice.author), selectinload(Notice.attachments))
        .filter_by(id=notice_id)
        .first()
    )
    if not notice or notice.deleted_at:
        return jsonify({'error': 'Notice not found.'}), 404

    inactive_budget_response = abort_if_inactive_budget_notice(notice)
    if inactive_budget_response:
        return inactive_budget_response

    current_user_id = optional_current_user_id()
    my_reaction = None
    if current_user_id:
        reaction = NoticeReaction.query.filter_by(notice_id=notice_id, user_id=current_user_id).first()
        if reaction:
            my_reaction = reaction.type.value

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
        return jsonify({'error': 'file field is required.'}), 400
    file = request.files['file']

    result = validate_upload(file, current_app.config, require_image=False)
    if not result.get('ok'):
        return jsonify({'error': result.get('error', 'File validation failed.')}), 422

    saved = save_upload_for_scope(file, current_app.config, 'notices')
    canonical_url = saved['url']
    preview_url = build_upload_preview_url(current_app.config, 'notices', saved['filename'])

    return jsonify(
        {
            'id': saved['filename'],
            'name': result['name'],
            'size': result['size'],
            'url': preview_url,
            'canonicalUrl': canonical_url,
            'mime': result['mime'],
            'kind': result['kind'],
        }
    ), 201


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
        attachment = Attachment.query.filter(Attachment.url.like(f'%{attachment_url}%')).first()

    notice = attachment.notice if attachment else None
    if not notice:
        notice = Notice.query.filter(
            Notice.deleted_at.is_(None),
            Notice.body.ilike(f'%{attachment_url}%'),
        ).first()

    if notice:
        inactive_budget_response = abort_if_inactive_budget_notice(notice)
        if inactive_budget_response:
            return inactive_budget_response

    if not notice:
        if not file_path.exists():
            return jsonify({'error': 'Attachment not found.'}), 404
        preview_token = request.args.get('preview_token', '')
        if not is_valid_upload_preview_token(
            current_app.config,
            'notices',
            filename,
            preview_token,
        ):
            return jsonify({'error': 'Attachment not found.'}), 404

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
        download_name=download_name,
    )
    response.headers['X-Content-Type-Options'] = 'nosniff'
    return response


@notices_bp.route('/<int:notice_id>/comments', methods=['GET'])
@cache_json_response('notices')
def list_comments(notice_id):
    """List notice comments with deterministic ordering and pagination."""
    notice = Notice.query.get(notice_id)
    if not notice or notice.deleted_at:
        return jsonify({'error': 'Notice not found.'}), 404

    inactive_budget_response = abort_if_inactive_budget_notice(notice)
    if inactive_budget_response:
        return inactive_budget_response

    page, page_size = parse_pagination(request)
    order = request.args.get('order', 'asc')
    query = Comment.query.options(joinedload(Comment.user)).filter(
        Comment.notice_id == notice_id,
        Comment.deleted_at.is_(None),
    )
    total = query.count()
    if order == 'desc':
        query = query.order_by(Comment.created_at.desc())
    else:
        query = query.order_by(Comment.created_at.asc())
    items = query.offset((page - 1) * page_size).limit(page_size).all()

    return jsonify(build_paginated_response([comment.to_dict() for comment in items], total, page, page_size))


@notices_bp.route('/<int:notice_id>/comments', methods=['POST'])
@jwt_required()
def create_comment(notice_id):
    """Create one notice comment for authenticated user."""
    notice = Notice.query.get(notice_id)
    if not notice or notice.deleted_at:
        return jsonify({'error': 'Notice not found.'}), 404

    inactive_budget_response = abort_if_inactive_budget_notice(notice)
    if inactive_budget_response:
        return inactive_budget_response

    data = request.get_json() or {}
    body = (data.get('body') or '').strip()
    if not body or len(body) > 1000:
        return jsonify({'error': 'Comment body must be between 1 and 1000 characters.'}), 422

    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404

    comment = Comment(notice_id=notice_id, user_id=user.id, body=body)

    try:
        db.session.add(comment)
        db.session.commit()
        invalidate_cache_namespaces('notices')
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': 'Failed to create comment.'}), 500

    return jsonify(comment.to_dict()), 201


@notices_bp.route('/<int:notice_id>/comments/<int:comment_id>', methods=['DELETE'])
@jwt_required()
@require_role(UserRole.ADMIN)
def delete_comment(notice_id, comment_id):
    """Soft-delete notice comment (admin only)."""
    notice = Notice.query.get(notice_id)
    if not notice or notice.deleted_at:
        return jsonify({'error': 'Notice not found.'}), 404

    inactive_budget_response = abort_if_inactive_budget_notice(notice)
    if inactive_budget_response:
        return inactive_budget_response

    comment = Comment.query.filter_by(id=comment_id, notice_id=notice_id).first()
    if not comment or comment.deleted_at:
        return jsonify({'error': 'Comment not found.'}), 404

    try:
        comment.deleted_at = db.func.now()
        db.session.commit()
        invalidate_cache_namespaces('notices')
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': 'Failed to delete comment.'}), 500

    return jsonify({'message': 'Comment deleted.'}), 200


@notices_bp.route('/<int:notice_id>/reactions', methods=['POST'])
@jwt_required()
def react_notice(notice_id):
    """Toggle or switch reaction and maintain denormalized counters."""
    notice = Notice.query.get(notice_id)
    if not notice or notice.deleted_at:
        return jsonify({'error': 'Notice not found.'}), 404

    inactive_budget_response = abort_if_inactive_budget_notice(notice)
    if inactive_budget_response:
        return inactive_budget_response

    data = request.get_json() or {}
    reaction_type = data.get('type')
    if reaction_type not in (ReactionType.LIKE.value, ReactionType.DISLIKE.value):
        return jsonify({'error': 'type must be one of like or dislike.'}), 422

    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404

    existing = NoticeReaction.query.filter_by(notice_id=notice_id, user_id=user.id).first()

    try:
        if existing and existing.type.value == reaction_type:
            if reaction_type == ReactionType.LIKE.value and notice.like_count > 0:
                notice.like_count -= 1
            if reaction_type == ReactionType.DISLIKE.value and notice.dislike_count > 0:
                notice.dislike_count -= 1
            db.session.delete(existing)
            my_reaction = None
        else:
            if existing:
                if existing.type == ReactionType.LIKE and notice.like_count > 0:
                    notice.like_count -= 1
                if existing.type == ReactionType.DISLIKE and notice.dislike_count > 0:
                    notice.dislike_count -= 1
                existing.type = ReactionType(reaction_type)
                my_reaction = reaction_type
            else:
                db.session.add(
                    NoticeReaction(
                        notice_id=notice_id,
                        user_id=user.id,
                        type=ReactionType(reaction_type),
                    )
                )
                my_reaction = reaction_type

            if reaction_type == ReactionType.LIKE.value:
                notice.like_count += 1
            else:
                notice.dislike_count += 1

        db.session.commit()
        invalidate_cache_namespaces('notices')
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': 'Failed to update reaction.'}), 500

    return jsonify(
        {
            'likes': notice.like_count,
            'dislikes': notice.dislike_count,
            'myReaction': my_reaction,
        }
    )
