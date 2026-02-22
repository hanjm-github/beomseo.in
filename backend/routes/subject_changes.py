"""
Subject change board routes with approval, likes, comments.
"""
from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import or_
from sqlalchemy.orm import joinedload

from models import (
    db,
    User,
    UserRole,
    SubjectChange,
    SubjectChangeComment,
    MatchStatus,
    ApprovalStatus,
    ContactType,
)
from utils.pagination import parse_pagination, build_paginated_response
from utils.security import require_role, get_current_user
from utils.cache import cache_json_response, invalidate_cache_namespaces

subject_changes_bp = Blueprint('subject_changes', __name__, url_prefix='/api/subject-changes')


def parse_bool(val):
    if val is None:
        return None
    return str(val).lower() in {'1', 'true', 'yes', 'on'}


def optional_current_user():
    try:
        verify_jwt_in_request(optional=True)
        uid = get_jwt_identity()
        return User.query.get(int(uid)) if uid else None
    except Exception:
        return None


def _valid_url(url: str):
    if not url:
        return False
    lower = url.lower()
    return lower.startswith('http://') or lower.startswith('https://') or lower.startswith('mailto:')


def validate_payload(data):
    errors = []
    try:
        grade = int(data.get('grade'))
    except Exception:
        grade = None
    class_name = (data.get('className') or '').strip() or None
    offering_subject = (data.get('offeringSubject') or '').strip()
    requesting_subject = (data.get('requestingSubject') or '').strip()
    note = (data.get('note') or '').strip()
    contact_links = data.get('contactLinks') or []
    status_raw = data.get('status') or MatchStatus.OPEN.value

    if grade not in {1, 2, 3}:
        errors.append('학년은 1~3 사이여야 합니다.')
    if class_name and len(class_name) > 20:
        errors.append('반 정보는 20자 이하로 입력해 주세요.')
    if not offering_subject or len(offering_subject) < 2 or len(offering_subject) > 120:
        errors.append('줄 수 있는 과목은 2~120자로 입력해 주세요.')
    if not requesting_subject or len(requesting_subject) < 2 or len(requesting_subject) > 120:
        errors.append('받고 싶은 과목은 2~120자로 입력해 주세요.')
    if note and len(note) > 1000:
        errors.append('메모는 1000자 이하로 입력해 주세요.')

    contact_list = []
    if len(contact_links) > 3:
        errors.append('연락 수단은 최대 3개까지 입력 가능합니다.')
    else:
        for idx, c in enumerate(contact_links):
            c_type = c.get('type')
            if c_type in {ContactType.KAKAO.value, ContactType.EMAIL.value, ContactType.URL.value}:
                url = (c.get('url') or '').strip()
                if not url or len(url) > 500 or not _valid_url(url):
                    errors.append(f'연락 수단 #{idx+1}의 링크를 확인해 주세요.')
                    continue
                contact_list.append({'type': c_type, 'url': url})
                continue

            if c_type == ContactType.STUDENT_ID.value:
                value = str(c.get('value') or c.get('url') or '').strip()
                if not value or len(value) > 50:
                    errors.append(f'연락 수단 #{idx+1}의 학번을 확인해 주세요.')
                    continue
                contact_list.append({'type': c_type, 'value': value})
                continue

            if c_type == ContactType.EXTRA.value:
                value = str(c.get('value') or c.get('url') or '').strip()
                if not value or len(value) > 500:
                    errors.append(f'연락 수단 #{idx+1}의 기타 연락 방법을 확인해 주세요.')
                    continue
                contact_list.append({'type': c_type, 'value': value})
                continue

            errors.append(
                f'연락 수단 #{idx+1} type은 kakao/email/url/student_id/extra 중 하나여야 합니다.'
            )

    if status_raw not in {m.value for m in MatchStatus}:
        errors.append('status는 open/negotiating/matched 중 하나여야 합니다.')
        status = MatchStatus.OPEN
    else:
        status = MatchStatus(status_raw)

    return errors, {
        'grade': grade,
        'class_name': class_name,
        'offering_subject': offering_subject,
        'requesting_subject': requesting_subject,
        'note': note,
        'contact_links': contact_list,
        'status': status,
    }


def is_admin(user: User):
    return user and user.role == UserRole.ADMIN


def can_edit(item: SubjectChange, user: User):
    if is_admin(user):
        return True
    return user and item.author_id == user.id and not item.deleted_at


def apply_filters(query, grade=None, q_text=None, subject_tag=None, hide_closed=None,
                  only_mine=None, status=None, current_user: User = None):
    query = query.filter(SubjectChange.deleted_at.is_(None))
    if grade in {1, 2, 3}:
        query = query.filter(SubjectChange.grade == grade)

    if hide_closed:
        query = query.filter(SubjectChange.status != MatchStatus.MATCHED)

    if subject_tag and subject_tag != 'all':
        pattern = f"%{subject_tag}%"
        query = query.filter(
            or_(
                SubjectChange.offering_subject.ilike(pattern),
                SubjectChange.requesting_subject.ilike(pattern),
            )
        )

    if status in {ApprovalStatus.PENDING.value, ApprovalStatus.PENDING}:
        query = query.filter(SubjectChange.approval_status == ApprovalStatus.PENDING)
    elif status in {ApprovalStatus.APPROVED.value, ApprovalStatus.APPROVED}:
        query = query.filter(SubjectChange.approval_status == ApprovalStatus.APPROVED)

    if q_text:
        pattern = f"%{q_text}%"
        query = query.join(User).filter(
            or_(
                SubjectChange.offering_subject.ilike(pattern),
                SubjectChange.requesting_subject.ilike(pattern),
                SubjectChange.note.ilike(pattern),
                User.nickname.ilike(pattern),
            )
        )

    if only_mine and current_user:
        query = query.filter(SubjectChange.author_id == current_user.id)

    if not is_admin(current_user):
        if current_user:
            query = query.filter(
                or_(
                    SubjectChange.approval_status == ApprovalStatus.APPROVED,
                    SubjectChange.author_id == current_user.id,
                )
            )
        else:
            query = query.filter(SubjectChange.approval_status == ApprovalStatus.APPROVED)
    return query


def fetch_or_404(item_id):
    item = SubjectChange.query.options(
        joinedload(SubjectChange.author),
        joinedload(SubjectChange.approved_by),
    ).filter_by(id=item_id).first()
    if not item or item.deleted_at:
        return None
    return item


@subject_changes_bp.route('', methods=['GET'])
@subject_changes_bp.route('/', methods=['GET'])
@cache_json_response('subject_changes')
def list_subject_changes():
    grade = request.args.get('grade')
    try:
        grade = int(grade) if grade is not None else None
    except Exception:
        grade = None
    q_text = request.args.get('q') or request.args.get('query')
    subject_tag = request.args.get('subjectTag')
    only_mine = parse_bool(request.args.get('onlyMine'))
    hide_closed = parse_bool(request.args.get('hideClosed'))
    status = request.args.get('status')
    view = request.args.get('view')

    page, page_size = parse_pagination(request, default_page_size=12, max_page_size=50)

    current_user = optional_current_user()
    admin_mode = is_admin(current_user)
    if not admin_mode:
        # Non-admin users can still see their own pending posts.
        status = None

    query = SubjectChange.query.options(
        joinedload(SubjectChange.author),
        joinedload(SubjectChange.approved_by),
    )
    query = apply_filters(query, grade, q_text, subject_tag, hide_closed, only_mine, status, current_user)
    total = query.count()
    items = query.order_by(SubjectChange.updated_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return jsonify(
        build_paginated_response(
            [i.to_list_dict() if view == 'list' else i.to_dict(include_note=True) for i in items],
            total,
            page,
            page_size,
        )
    )


@subject_changes_bp.route('', methods=['POST'])
@subject_changes_bp.route('/', methods=['POST'])
@jwt_required()
def create_subject_change():
    data = request.get_json() or {}
    errors, payload = validate_payload(data)
    if errors:
        return jsonify({'errors': errors}), 422

    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404

    item = SubjectChange(
        grade=payload['grade'],
        class_name=payload['class_name'],
        offering_subject=payload['offering_subject'],
        requesting_subject=payload['requesting_subject'],
        note=payload['note'],
        contact_links=payload['contact_links'],
        status=payload['status'],
        approval_status=ApprovalStatus.PENDING,
        author_id=user.id,
        author_role=user.role.value,
    )
    try:
        db.session.add(item)
        db.session.commit()
        invalidate_cache_namespaces('subject_changes')
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '저장 중 오류가 발생했습니다.'}), 500

    return jsonify(item.to_dict()), 201


@subject_changes_bp.route('/<int:item_id>', methods=['GET'])
@jwt_required()
def get_subject_change(item_id):
    item = fetch_or_404(item_id)
    if not item:
        return jsonify({'error': '게시글을 찾을 수 없습니다.'}), 404

    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'User not found'}), 404

    if item.approval_status != ApprovalStatus.APPROVED and not (is_admin(current_user) or (current_user and current_user.id == item.author_id)):
        return jsonify({'error': '열람 권한이 없습니다.'}), 403

    try:
        item.views += 1
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()

    return jsonify(item.to_dict())


@subject_changes_bp.route('/<int:item_id>', methods=['PUT'])
@jwt_required()
def update_subject_change(item_id):
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

    item.grade = payload['grade']
    item.class_name = payload['class_name']
    item.offering_subject = payload['offering_subject']
    item.requesting_subject = payload['requesting_subject']
    item.note = payload['note']
    item.contact_links = payload['contact_links']
    item.status = payload['status']
    if not is_admin(user):
        item.approval_status = ApprovalStatus.PENDING
        item.approved_by_id = None
        item.approved_at = None

    try:
        db.session.commit()
        invalidate_cache_namespaces('subject_changes')
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '수정 중 오류가 발생했습니다.'}), 500

    return jsonify(item.to_dict())


@subject_changes_bp.route('/<int:item_id>', methods=['DELETE'])
@jwt_required()
def delete_subject_change(item_id):
    item = fetch_or_404(item_id)
    if not item:
        return jsonify({'error': '게시글을 찾을 수 없습니다.'}), 404

    user = get_current_user()
    if not (is_admin(user) or (user and item.author_id == user.id)):
        return jsonify({'error': '삭제 권한이 없습니다.'}), 403

    try:
        item.deleted_at = db.func.now()
        db.session.commit()
        invalidate_cache_namespaces('subject_changes')
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '삭제 중 오류가 발생했습니다.'}), 500

    return jsonify({'message': '삭제되었습니다.'}), 200


@subject_changes_bp.route('/<int:item_id>/approve', methods=['POST'])
@jwt_required()
@require_role(UserRole.ADMIN)
def approve_subject_change(item_id):
    item = fetch_or_404(item_id)
    if not item:
        return jsonify({'error': '게시글을 찾을 수 없습니다.'}), 404

    item.approval_status = ApprovalStatus.APPROVED
    item.approved_by_id = get_current_user().id
    item.approved_at = datetime.utcnow()
    try:
        db.session.commit()
        invalidate_cache_namespaces('subject_changes')
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '승인 처리 중 오류가 발생했습니다.'}), 500
    return jsonify(item.to_dict())


@subject_changes_bp.route('/<int:item_id>/unapprove', methods=['POST'])
@jwt_required()
@require_role(UserRole.ADMIN)
def unapprove_subject_change(item_id):
    item = fetch_or_404(item_id)
    if not item:
        return jsonify({'error': '게시글을 찾을 수 없습니다.'}), 404

    item.approval_status = ApprovalStatus.PENDING
    item.approved_by_id = None
    item.approved_at = None
    try:
        db.session.commit()
        invalidate_cache_namespaces('subject_changes')
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '승인 해제 중 오류가 발생했습니다.'}), 500
    return jsonify(item.to_dict())


@subject_changes_bp.route('/<int:item_id>/status', methods=['POST'])
@jwt_required()
def change_match_status(item_id):
    item = fetch_or_404(item_id)
    if not item:
        return jsonify({'error': '게시글을 찾을 수 없습니다.'}), 404

    user = get_current_user()
    if not can_edit(item, user):
        return jsonify({'error': '변경 권한이 없습니다.'}), 403

    data = request.get_json() or {}
    status_raw = data.get('status')
    if status_raw not in {m.value for m in MatchStatus}:
        return jsonify({'error': 'status는 open/negotiating/matched 중 하나여야 합니다.'}), 422

    item.status = MatchStatus(status_raw)
    try:
        db.session.commit()
        invalidate_cache_namespaces('subject_changes')
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '상태 변경 중 오류가 발생했습니다.'}), 500

    return jsonify(item.to_dict())


# ----- Comments -----


@subject_changes_bp.route('/<int:item_id>/comments', methods=['GET'])
@jwt_required()
@cache_json_response('subject_changes')
def list_comments(item_id):
    item = fetch_or_404(item_id)
    if not item:
        return jsonify({'error': '게시글을 찾을 수 없습니다.'}), 404

    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'User not found'}), 404

    if item.approval_status != ApprovalStatus.APPROVED and not (is_admin(current_user) or (current_user and current_user.id == item.author_id)):
        return jsonify({'error': '열람 권한이 없습니다.'}), 403

    page, page_size = parse_pagination(request)
    order = request.args.get('order', 'asc')
    q = SubjectChangeComment.query.options(
        joinedload(SubjectChangeComment.user),
    ).filter(
        SubjectChangeComment.subject_change_id == item.id,
        SubjectChangeComment.deleted_at.is_(None)
    )
    total = q.count()
    if order == 'desc':
        q = q.order_by(SubjectChangeComment.created_at.desc())
    else:
        q = q.order_by(SubjectChangeComment.created_at.asc())
    items = q.offset((page - 1) * page_size).limit(page_size).all()

    return jsonify(
        build_paginated_response(
            [c.to_dict() for c in items],
            total,
            page,
            page_size,
        )
    )


@subject_changes_bp.route('/<int:item_id>/comments', methods=['POST'])
@jwt_required()
def create_comment(item_id):
    item = fetch_or_404(item_id)
    if not item:
        return jsonify({'error': '게시글을 찾을 수 없습니다.'}), 404

    current_user = get_current_user()
    if item.approval_status != ApprovalStatus.APPROVED and not (is_admin(current_user) or (current_user and current_user.id == item.author_id)):
        return jsonify({'error': '댓글 작성 권한이 없습니다.'}), 403

    data = request.get_json() or {}
    body = (data.get('body') or '').strip()
    if not body or len(body) > 800:
        return jsonify({'error': '댓글은 1~800자 사이여야 합니다.'}), 422

    comment = SubjectChangeComment(
        subject_change_id=item.id,
        user_id=current_user.id,
        body=body,
    )
    try:
        db.session.add(comment)
        item.comment_count += 1
        db.session.commit()
        invalidate_cache_namespaces('subject_changes')
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '댓글 저장 중 오류가 발생했습니다.'}), 500

    return jsonify(comment.to_dict()), 201


@subject_changes_bp.route('/<int:item_id>/comments/<int:comment_id>', methods=['DELETE'])
@jwt_required()
def delete_comment(item_id, comment_id):
    item = fetch_or_404(item_id)
    if not item:
        return jsonify({'error': '게시글을 찾을 수 없습니다.'}), 404

    user = get_current_user()
    comment = SubjectChangeComment.query.filter_by(id=comment_id, subject_change_id=item_id).first()
    if not comment or comment.deleted_at:
        return jsonify({'error': '댓글을 찾을 수 없습니다.'}), 404

    if not (is_admin(user) or (user and comment.user_id == user.id)):
        return jsonify({'error': '삭제 권한이 없습니다.'}), 403

    try:
        comment.deleted_at = db.func.now()
        if item.comment_count > 0:
            item.comment_count -= 1
        db.session.commit()
        invalidate_cache_namespaces('subject_changes')
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '댓글 삭제 중 오류가 발생했습니다.'}), 500

    return jsonify({'message': '삭제되었습니다.'}), 200
