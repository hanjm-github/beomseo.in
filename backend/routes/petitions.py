"""
Petition (학생 청원) routes.
"""
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from sqlalchemy import or_

from models import (
    db,
    User,
    UserRole,
    Petition,
    PetitionStatus,
    PetitionVote,
    PetitionAnswer,
)
from utils.pagination import parse_pagination, build_paginated_response
from utils.security import require_role, get_current_user
from utils.cache import cache_json_response, invalidate_cache_namespaces

petitions_bp = Blueprint('petitions', __name__, url_prefix='/api/community/petitions')
PETITION_CATEGORIES = (
    '기타',
    '회장단',
    '3학년부',
    '2학년부',
    '정보기술부',
    '방송부',
    '학예부',
    '체육부',
    '진로부',
    '홍보부',
    '기후환경부',
    '학생지원부',
    '생활안전부',
    '융합인재부',
)


def parse_bool(val):
    if val is None:
        return None
    return str(val).lower() in {'1', 'true', 'yes', 'on'}


def optional_current_user_id():
    try:
        verify_jwt_in_request(optional=True)
        uid = get_jwt_identity()
        return int(uid) if uid else None
    except Exception:
        return None


def summarize(text: str, limit: int = 500):
    clean = (text or '').strip()
    if len(clean) > limit:
        return f"{clean[:limit]}…"
    return clean


def validate_payload(data):
    errors = []
    title = (data.get('title') or '').strip()
    summary = (data.get('summary') or '').strip()
    body = (data.get('body') or '').strip()
    category = (data.get('category') or '').strip()

    if not 2 <= len(title) <= 200:
        errors.append('제목은 2~200자로 입력해주세요.')
    # UX: 프론트는 요약 1~200자로 안내하므로 서버도 범위 맞춤
    if not 1 <= len(summary) <= 200:
        errors.append('요약은 1~200자로 입력해주세요.')
    max_body = current_app.config.get('MAX_PETITION_BODY', 10000)
    if not body or len(body) > max_body:
        errors.append(f'본문은 필수이며 {max_body}자 이하이어야 합니다.')
    if category not in PETITION_CATEGORIES:
        errors.append('category는 기타/회장단/3학년부/2학년부/정보기술부/방송부/학예부/체육부/진로부/홍보부/기후환경부/학생지원부/생활안전부/융합인재부 중 하나여야 합니다.')

    return errors, {
        'title': title,
        'summary': summary,
        'body': body,
        'category': category,
    }


def base_query(include_deleted=False):
    q = Petition.query
    if not include_deleted:
        q = q.filter(Petition.deleted_at.is_(None))
    return q


@petitions_bp.route('/', methods=['GET'])
@petitions_bp.route('', methods=['GET'])
@cache_json_response('petitions')
def list_petitions():
    status = request.args.get('status')
    category = request.args.get('category')
    query_text = request.args.get('q')
    sort = request.args.get('sort', 'recent')
    page, page_size = parse_pagination(request, default_page_size=12, max_page_size=50)

    current_user_id = optional_current_user_id()
    current_user = User.query.get(current_user_id) if current_user_id else None
    is_admin = current_user and current_user.role == UserRole.ADMIN

    if not is_admin:
        status = PetitionStatus.APPROVED.value

    q = base_query()
    if status == PetitionStatus.PENDING.value:
        q = q.filter(Petition.status == PetitionStatus.PENDING)
    elif status == PetitionStatus.APPROVED.value:
        q = q.filter(Petition.status == PetitionStatus.APPROVED)
    elif status == PetitionStatus.REJECTED.value and is_admin:
        q = q.filter(Petition.status == PetitionStatus.REJECTED)
    # status == all for admin -> no filter

    if category in PETITION_CATEGORIES:
        q = q.filter(Petition.category == category)

    if query_text:
        pattern = f"%{query_text}%"
        q = q.filter(or_(Petition.title.ilike(pattern), Petition.summary.ilike(pattern), Petition.body.ilike(pattern)))

    if sort == 'votes':
        q = q.order_by(Petition.votes_count.desc(), Petition.created_at.desc())
    else:
        q = q.order_by(Petition.created_at.desc())

    total = q.count()
    items = q.offset((page - 1) * page_size).limit(page_size).all()

    voted_map = {}
    if current_user_id and items:
        ids = [p.id for p in items]
        votes = PetitionVote.query.filter(
            PetitionVote.user_id == current_user_id,
            PetitionVote.petition_id.in_(ids)
        ).all()
        voted_map = {v.petition_id: True for v in votes}

    return jsonify(
        build_paginated_response(
            [p.to_dict(include_body=False, is_voted_by_me=voted_map.get(p.id, False)) for p in items],
            total,
            page,
            page_size,
        )
    )


@petitions_bp.route('/', methods=['POST'])
@petitions_bp.route('', methods=['POST'])
@jwt_required()
def create_petition():
    data = request.get_json() or {}
    errors, payload = validate_payload(data)
    if errors:
        return jsonify({'errors': errors}), 422

    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404

    threshold = current_app.config.get('DEFAULT_PETITION_THRESHOLD', 50)
    petition = Petition(
        title=payload['title'],
        summary=payload['summary'],
        body=payload['body'],
        category=payload['category'],
        threshold=threshold,
        status=PetitionStatus.PENDING,
        author_id=user.id,
        author_role=user.role.value,
    )
    try:
        db.session.add(petition)
        db.session.commit()
        invalidate_cache_namespaces('petitions')
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '청원 저장 중 오류가 발생했습니다.'}), 500

    return jsonify(petition.to_dict()), 201


def fetch_petition_or_404(petition_id):
    petition = base_query().filter_by(id=petition_id).first()
    return petition


def can_edit(petition: Petition, user: User):
    if not user:
        return False
    if user.role == UserRole.ADMIN:
        return True
    if petition.status in {PetitionStatus.PENDING, PetitionStatus.REJECTED} and petition.author_id == user.id:
        return True
    return False


@petitions_bp.route('/<int:petition_id>', methods=['GET'])
@cache_json_response('petitions')
def get_petition(petition_id):
    petition = fetch_petition_or_404(petition_id)
    if not petition:
        return jsonify({'error': '청원을 찾을 수 없습니다.'}), 404

    current_user_id = optional_current_user_id()
    current_user = User.query.get(current_user_id) if current_user_id else None
    is_author = current_user and current_user.id == petition.author_id
    is_admin = current_user and current_user.role == UserRole.ADMIN

    if petition.status != PetitionStatus.APPROVED and not (is_admin or is_author):
        return jsonify({'error': '열람 권한이 없습니다.'}), 403

    is_voted = False
    if current_user_id:
        is_voted = PetitionVote.query.filter_by(petition_id=petition.id, user_id=current_user_id).first() is not None
    else:
        is_voted = False

    return jsonify(petition.to_dict(is_voted_by_me=is_voted))


@petitions_bp.route('/<int:petition_id>', methods=['PUT'])
@jwt_required()
def update_petition(petition_id):
    petition = fetch_petition_or_404(petition_id)
    if not petition:
        return jsonify({'error': '청원을 찾을 수 없습니다.'}), 404

    user = get_current_user()
    if not can_edit(petition, user):
        return jsonify({'error': '수정 권한이 없습니다.'}), 403

    data = request.get_json() or {}
    errors, payload = validate_payload(data)
    if errors:
        return jsonify({'errors': errors}), 422

    petition.title = payload['title']
    petition.summary = payload['summary']
    petition.body = payload['body']
    petition.category = payload['category']
    petition.updated_at = datetime.utcnow()

    try:
        db.session.commit()
        invalidate_cache_namespaces('petitions')
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '청원 수정 중 오류가 발생했습니다.'}), 500

    return jsonify(petition.to_dict())


@petitions_bp.route('/<int:petition_id>', methods=['DELETE'])
@jwt_required()
@require_role(UserRole.ADMIN)
def delete_petition(petition_id):
    petition = fetch_petition_or_404(petition_id)
    if not petition:
        return jsonify({'error': '청원을 찾을 수 없습니다.'}), 404

    try:
        petition.deleted_at = db.func.now()
        db.session.commit()
        invalidate_cache_namespaces('petitions')
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '청원 삭제 중 오류가 발생했습니다.'}), 500

    return jsonify({'message': '삭제되었습니다.'}), 200


@petitions_bp.route('/<int:petition_id>/approve', methods=['POST'])
@jwt_required()
@require_role(UserRole.ADMIN)
def approve_petition(petition_id):
    petition = fetch_petition_or_404(petition_id)
    if not petition:
        return jsonify({'error': '청원을 찾을 수 없습니다.'}), 404

    petition.status = PetitionStatus.APPROVED
    petition.approved_by_id = get_current_user().id
    petition.approved_at = datetime.utcnow()
    try:
        db.session.commit()
        invalidate_cache_namespaces('petitions')
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '승인 처리 중 오류가 발생했습니다.'}), 500
    return jsonify(petition.to_dict())


@petitions_bp.route('/<int:petition_id>/reject', methods=['POST'])
@jwt_required()
@require_role(UserRole.ADMIN)
def reject_petition(petition_id):
    petition = fetch_petition_or_404(petition_id)
    if not petition:
        return jsonify({'error': '청원을 찾을 수 없습니다.'}), 404

    petition.status = PetitionStatus.REJECTED
    petition.approved_by_id = None
    petition.approved_at = None
    try:
        db.session.commit()
        invalidate_cache_namespaces('petitions')
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '반려 처리 중 오류가 발생했습니다.'}), 500
    return jsonify(petition.to_dict())


@petitions_bp.route('/<int:petition_id>/vote', methods=['POST'])
@jwt_required()
def vote_petition(petition_id):
    petition = fetch_petition_or_404(petition_id)
    if not petition:
        return jsonify({'error': '청원을 찾을 수 없습니다.'}), 404

    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404

    data = request.get_json() or {}
    action = data.get('action', 'up')
    existing = PetitionVote.query.filter_by(petition_id=petition_id, user_id=user.id).first()

    try:
        if action == 'cancel':
            if existing:
                db.session.delete(existing)
                petition.votes_count = max(0, (petition.votes_count or 0) - 1)
        else:  # up
            if not existing:
                db.session.add(PetitionVote(petition_id=petition_id, user_id=user.id))
                petition.votes_count = (petition.votes_count or 0) + 1
        db.session.commit()
        invalidate_cache_namespaces('petitions')
    except IntegrityError:
        db.session.rollback()
        return jsonify({'error': '추천 처리 중 오류가 발생했습니다.'}), 500
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '추천 처리 중 오류가 발생했습니다.'}), 500

    return jsonify({
        'votes': petition.votes_count,
        'isVotedByMe': action != 'cancel',
        'status': petition.status_derived(),
    })


@petitions_bp.route('/<int:petition_id>/answer', methods=['POST'])
@jwt_required()
@require_role(UserRole.ADMIN, UserRole.STUDENT_COUNCIL)
def answer_petition(petition_id):
    petition = fetch_petition_or_404(petition_id)
    if not petition:
        return jsonify({'error': '청원을 찾을 수 없습니다.'}), 404

    data = request.get_json() or {}
    content = (data.get('content') or '').strip()
    if not content:
        return jsonify({'error': 'content는 필수입니다.'}), 422

    user = get_current_user()
    try:
        if petition.answer:
            petition.answer.content = content
            petition.answer.role = user.role.value
            petition.answer.responder_id = user.id
            petition.answer.updated_at = datetime.utcnow()
        else:
            answer = PetitionAnswer(
                petition_id=petition.id,
                content=content,
                role=user.role.value,
                responder_id=user.id,
                updated_at=datetime.utcnow(),
            )
            db.session.add(answer)
        db.session.commit()
        invalidate_cache_namespaces('petitions')
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '답변 저장 중 오류가 발생했습니다.'}), 500

    return jsonify(petition.to_dict())
