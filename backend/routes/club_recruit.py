"""
Club recruit board routes with admin approval workflow.
"""
from datetime import datetime
from pathlib import Path
from flask import Blueprint, request, jsonify, current_app, send_from_directory
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from sqlalchemy import or_, case
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import joinedload

from models import (
    db,
    User,
    UserRole,
    ClubRecruit,
    GradeGroup,
    RecruitStatus,
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

club_recruit_bp = Blueprint('club_recruit', __name__, url_prefix='/api/club-recruit')


def parse_bool(val):
    """Parse permissive boolean query values."""
    if val is None:
        return None
    return str(val).lower() in {'1', 'true', 'yes', 'on'}


def optional_current_user():
    """Return authenticated user when token exists; otherwise None."""
    try:
        verify_jwt_in_request(optional=True)
        uid = get_jwt_identity()
        return User.query.get(int(uid)) if uid else None
    except Exception:
        return None


def validate_payload(data):
    """Validate recruit payload and normalize date/poster fields."""
    errors = []
    club_name = (data.get('clubName') or '').strip()
    field = (data.get('field') or '').strip()
    grade_group = data.get('gradeGroup')
    apply_period = data.get('applyPeriod') or {}
    apply_start = ClubRecruit.normalize_date(apply_period.get('start') or data.get('applyStart'))
    apply_end = ClubRecruit.normalize_date(apply_period.get('end') or data.get('applyEnd'))
    apply_link = (data.get('applyLink') or '').strip() or None
    extra_note = (data.get('extraNote') or '').strip()
    body = data.get('body') or ''
    poster_url = (data.get('posterUrl') or '').strip() or None

    if poster_url:
        normalized_poster_url = normalize_upload_url_for_scope(current_app.config, 'club_recruit', poster_url)
        if normalized_poster_url:
            poster_url = normalized_poster_url

    if not club_name or len(club_name) > 120:
        errors.append('동아리 이름은 1~120자로 입력해주세요.')
    if not field or len(field) > 120:
        errors.append('동아리 활동 분야를 1~120자로 입력해주세요.')
    if grade_group not in (GradeGroup.LOWER.value, GradeGroup.UPPER.value):
        grade_group = GradeGroup.LOWER.value  # fail-soft default
    if not apply_start:
        from datetime import date
        apply_start = date.today()
    if apply_end and apply_start and apply_end < apply_start:
        errors.append('모집 종료일은 시작일 이후여야 합니다.')
    if apply_link and len(apply_link) > 500:
        errors.append('applyLink는 500자 이하로 입력해주세요.')
    if not extra_note or len(extra_note) > 200:
        errors.append('기타 사항은 1~200자로 입력해주세요.')
    if body and len(body) > 20000:
        errors.append('본문은 최대 20,000자까지 가능합니다.')
    if poster_url and len(poster_url) > 500:
        errors.append('posterUrl은 500자 이하로 입력해주세요.')

    return errors, {
        'club_name': club_name,
        'field': field,
        'grade_group': GradeGroup(grade_group) if grade_group in (GradeGroup.LOWER.value, GradeGroup.UPPER.value) else None,
        'apply_start': apply_start,
        'apply_end': apply_end,
        'apply_link': apply_link,
        'extra_note': extra_note,
        'body': body,
        'poster_url': poster_url,
    }


def is_admin(user: User):
    """Role helper for approval visibility and moderation checks."""
    return user and user.role == UserRole.ADMIN


def can_edit(item: ClubRecruit, user: User):
    """Author can edit own non-deleted items; admin can edit any item."""
    if is_admin(user):
        return True
    return user and item.author_id == user.id and not item.deleted_at


def apply_filters(query, grade_group, status, q_text, user):
    """Apply list filters and role-based visibility constraints."""
    query = query.filter(ClubRecruit.deleted_at.is_(None))
    if grade_group in {GradeGroup.LOWER.value, GradeGroup.LOWER}:
        query = query.filter(ClubRecruit.grade_group == GradeGroup.LOWER)
    elif grade_group in {GradeGroup.UPPER.value, GradeGroup.UPPER}:
        query = query.filter(ClubRecruit.grade_group == GradeGroup.UPPER)

    if status in {RecruitStatus.PENDING.value, RecruitStatus.PENDING}:
        query = query.filter(ClubRecruit.status == RecruitStatus.PENDING)
    elif status in {RecruitStatus.APPROVED.value, RecruitStatus.APPROVED}:
        query = query.filter(ClubRecruit.status == RecruitStatus.APPROVED)

    if q_text:
        pattern = f"%{q_text}%"
        query = query.filter(
            or_(
                ClubRecruit.club_name.ilike(pattern),
                ClubRecruit.field.ilike(pattern),
                ClubRecruit.extra_note.ilike(pattern),
                ClubRecruit.body.ilike(pattern),
            )
        )

    if not is_admin(user):
        if user:
            query = query.filter(
                or_(
                    ClubRecruit.status == RecruitStatus.APPROVED,
                    ClubRecruit.author_id == user.id,
                )
            )
        else:
            query = query.filter(ClubRecruit.status == RecruitStatus.APPROVED)
    return query


def apply_sort(query, sort):
    """Apply supported sort modes (`recent`, `deadline`)."""
    if sort == 'deadline':
        # Null apply_end last
        return query.order_by(
            case((ClubRecruit.apply_end.is_(None), 1), else_=0),
            ClubRecruit.apply_end.asc(),
            ClubRecruit.created_at.desc(),
        )
    return query.order_by(ClubRecruit.created_at.desc())


@club_recruit_bp.route('', methods=['GET'])
@club_recruit_bp.route('/', methods=['GET'])
@cache_json_response('club_recruit')
def list_recruits():
    """List recruit posts with moderation-aware visibility policy."""
    grade_group = request.args.get('gradeGroup')
    q_text = request.args.get('q') or request.args.get('query')
    sort = request.args.get('sort', 'recent')
    status = request.args.get('status')
    view = request.args.get('view')
    page, page_size = parse_pagination(request, default_page_size=12, max_page_size=50)

    current_user = optional_current_user()
    if not is_admin(current_user):
        # Non-admin users can still see their own pending posts.
        status = None

    query = ClubRecruit.query.options(
        joinedload(ClubRecruit.author),
        joinedload(ClubRecruit.approved_by),
    )
    query = apply_filters(query, grade_group, status, q_text, current_user)
    total = query.count()
    items = apply_sort(query, sort).offset((page - 1) * page_size).limit(page_size).all()

    return jsonify(
        build_paginated_response(
            [
                i.to_list_dict() if view == 'list' else i.to_dict(include_body=False)
                for i in items
            ],
            total,
            page,
            page_size,
        )
    )


@club_recruit_bp.route('', methods=['POST'])
@club_recruit_bp.route('/', methods=['POST'])
@jwt_required()
def create_recruit():
    """Create recruit post in pending approval state."""
    data = request.get_json() or {}
    errors, payload = validate_payload(data)
    if errors:
        return jsonify({'errors': errors}), 422

    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404

    item = ClubRecruit(
        club_name=payload['club_name'],
        field=payload['field'],
        grade_group=payload['grade_group'],
        apply_start=payload['apply_start'],
        apply_end=payload['apply_end'],
        apply_link=payload['apply_link'],
        extra_note=payload['extra_note'],
        body=payload['body'],
        poster_url=payload['poster_url'],
        status=RecruitStatus.PENDING,
        author_id=user.id,
        author_role=user.role.value,
    )
    try:
        db.session.add(item)
        db.session.commit()
        invalidate_cache_namespaces('club_recruit')
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '저장 중 오류가 발생했습니다.'}), 500

    return jsonify(item.to_dict()), 201


def fetch_or_404(item_id):
    """Fetch non-deleted recruit row with author/approver eager-loaded."""
    item = ClubRecruit.query.options(
        joinedload(ClubRecruit.author),
        joinedload(ClubRecruit.approved_by),
    ).filter_by(id=item_id).first()
    if not item or item.deleted_at:
        return None
    return item


@club_recruit_bp.route('/<int:item_id>', methods=['GET'])
def get_recruit(item_id):
    """Return recruit detail with visibility checks for pending rows."""
    item = fetch_or_404(item_id)
    if not item:
        return jsonify({'error': '게시글을 찾을 수 없습니다.'}), 404

    current_user = optional_current_user()
    if item.status != RecruitStatus.APPROVED and not (is_admin(current_user) or (current_user and current_user.id == item.author_id)):
        return jsonify({'error': '열람 권한이 없습니다.'}), 403

    try:
        item.views += 1
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()

    return jsonify(item.to_dict())


@club_recruit_bp.route('/<int:item_id>', methods=['PUT'])
@jwt_required()
def update_recruit(item_id):
    """Update recruit post fields when caller has edit permission."""
    item = fetch_or_404(item_id)
    if not item:
        return jsonify({'error': '게시글을 찾을 수 없습니다.'}), 404

    user = get_current_user()
    if not can_edit(item, user):
        return jsonify({'error': '수정 권한이 없습니다.'}), 403

    data = request.get_json() or {}
    errors, payload = validate_payload(data)
    if errors:
        return jsonify({'errors': errors}), 422

    item.club_name = payload['club_name']
    item.field = payload['field']
    item.grade_group = payload['grade_group']
    item.apply_start = payload['apply_start']
    item.apply_end = payload['apply_end']
    item.apply_link = payload['apply_link']
    item.extra_note = payload['extra_note']
    item.body = payload['body']
    item.poster_url = payload['poster_url']

    try:
        db.session.commit()
        invalidate_cache_namespaces('club_recruit')
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '수정 중 오류가 발생했습니다.'}), 500

    return jsonify(item.to_dict())


@club_recruit_bp.route('/<int:item_id>', methods=['DELETE'])
@jwt_required()
@require_role(UserRole.ADMIN)
def delete_recruit(item_id):
    """Soft-delete recruit post (admin only)."""
    item = fetch_or_404(item_id)
    if not item:
        return jsonify({'error': '게시글을 찾을 수 없습니다.'}), 404

    try:
        item.deleted_at = db.func.now()
        db.session.commit()
        invalidate_cache_namespaces('club_recruit')
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '삭제 중 오류가 발생했습니다.'}), 500

    return jsonify({'message': '삭제되었습니다.'}), 200


@club_recruit_bp.route('/<int:item_id>/approve', methods=['POST'])
@jwt_required()
@require_role(UserRole.ADMIN)
def approve_recruit(item_id):
    """Approve recruit post and capture approver metadata."""
    item = fetch_or_404(item_id)
    if not item:
        return jsonify({'error': '게시글을 찾을 수 없습니다.'}), 404

    item.status = RecruitStatus.APPROVED
    item.approved_by_id = get_current_user().id
    item.approved_at = datetime.utcnow()
    try:
        db.session.commit()
        invalidate_cache_namespaces('club_recruit')
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '승인 처리 중 오류가 발생했습니다.'}), 500
    return jsonify(item.to_dict())


@club_recruit_bp.route('/<int:item_id>/unapprove', methods=['POST'])
@jwt_required()
@require_role(UserRole.ADMIN)
def unapprove_recruit(item_id):
    """Revert recruit post back to pending approval."""
    item = fetch_or_404(item_id)
    if not item:
        return jsonify({'error': '게시글을 찾을 수 없습니다.'}), 404

    item.status = RecruitStatus.PENDING
    item.approved_by_id = None
    item.approved_at = None
    try:
        db.session.commit()
        invalidate_cache_namespaces('club_recruit')
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '승인 취소 중 오류가 발생했습니다.'}), 500
    return jsonify(item.to_dict())


@club_recruit_bp.route('/uploads', methods=['POST'])
@club_recruit_bp.route('/uploads/', methods=['POST'])
@jwt_required()
def upload_poster():
    """Validate/store club recruit poster image."""
    if 'file' not in request.files:
        return jsonify({'error': 'file 필드가 필요합니다.'}), 400
    file = request.files['file']

    result = validate_upload(file, current_app.config, require_image=True)
    if not result.get('ok'):
        return jsonify({'error': result.get('error', '파일 검증에 실패했습니다.')}), 422

    saved = save_upload_for_scope(file, current_app.config, 'club_recruit')

    return jsonify({
        'id': saved['filename'],
        'name': result['name'],
        'size': result['size'],
        'url': saved['url'],
        'mime': result['mime'],
        'kind': result['kind']
    }), 201


@club_recruit_bp.route('/uploads/<path:filename>', methods=['GET'], strict_slashes=False)
def serve_poster(filename):
    """Serve poster with pending-content access controls and temp fallback."""
    upload_dir = resolve_scope_upload_dir(current_app.config, 'club_recruit')
    ensure_dir(upload_dir)
    file_path = Path(upload_dir) / filename
    poster_url = build_upload_url(current_app.config, 'club_recruit', filename)
    item = ClubRecruit.query.filter(
        ClubRecruit.deleted_at.is_(None),
        ClubRecruit.poster_url == poster_url
    ).first()
    if not item:
        # Backward compatibility for rows that stored absolute URLs.
        item = ClubRecruit.query.filter(
            ClubRecruit.deleted_at.is_(None),
            ClubRecruit.poster_url.like(f'%{poster_url}')
        ).first()
    if not item:
        # Inline editor images can exist only in body HTML (without poster_url matching).
        item = ClubRecruit.query.filter(
            ClubRecruit.deleted_at.is_(None),
            ClubRecruit.body.ilike(f'%{poster_url}%')
        ).first()
    if not item:
        if not file_path.exists():
            return jsonify({'error': '첨부파일을 찾을 수 없습니다.'}), 404
        # Allow temporary preview for newly uploaded poster/editor image before post save.
        response = send_from_directory(upload_dir, filename, as_attachment=False, download_name=filename)
        response.headers['X-Content-Type-Options'] = 'nosniff'
        return response

    current_user = optional_current_user()
    if item.status != RecruitStatus.APPROVED and not (is_admin(current_user) or (current_user and current_user.id == item.author_id)):
        return jsonify({'error': '열람 권한이 없습니다.'}), 403

    response = send_from_directory(upload_dir, filename, as_attachment=False, download_name=filename)
    response.headers['X-Content-Type-Options'] = 'nosniff'
    return response
