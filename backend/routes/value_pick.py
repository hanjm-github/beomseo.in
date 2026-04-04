"""
Value Pick board routes with approval workflow.
"""
from datetime import datetime
from pathlib import Path

from flask import Blueprint, request, jsonify, current_app, send_from_directory
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import joinedload

from models import (
    db,
    User,
    UserRole,
    ValuePickPost,
    ValuePickComment,
    ValuePickReaction,
    ValuePickReactionType,
    ValuePickStatus,
)
from utils.pagination import parse_pagination, build_paginated_response
from utils.files import (
    build_upload_preview_url,
    canonicalize_upload_urls_in_text,
    save_upload_for_scope,
    resolve_upload_path_for_scope,
    ensure_dir,
    is_valid_upload_preview_token,
    validate_upload,
    build_upload_url,
)
from utils.security import require_role, get_current_user, sanitize_plain_text
from utils.cache import cache_json_response, invalidate_cache_namespaces

value_pick_bp = Blueprint('value_pick', __name__, url_prefix='/api/community/value-pick')

MAX_COMPETENCY_LENGTH = 50
MAX_PLEDGE_LENGTH = 180
MAX_BODY_LENGTH = 10000


def parse_bool(value):
    """Parse permissive boolean query values."""
    if value is None:
        return None
    return str(value).lower() in {'1', 'true', 'yes', 'on'}


def optional_current_user_id():
    """Return authenticated user id when token exists; else None."""
    try:
        verify_jwt_in_request(optional=True)
        user_id = get_jwt_identity()
        return int(user_id) if user_id else None
    except Exception:
        return None


def is_admin(user: User):
    """Role helper for moderation/visibility checks."""
    return user and user.role == UserRole.ADMIN


def can_edit(post: ValuePickPost, user: User):
    """Author can edit own non-deleted post; admin can edit any post."""
    if is_admin(user):
        return True
    return user and post.author_id == user.id and not post.deleted_at


def validate_payload(data):
    """Validate create/update payload."""
    errors = []
    competency = sanitize_plain_text(data.get('competency', ''), max_length=MAX_COMPETENCY_LENGTH)
    pledge = sanitize_plain_text(data.get('pledge', ''), max_length=MAX_PLEDGE_LENGTH)

    raw_body = data.get('body') or ''
    if not isinstance(raw_body, str):
        raw_body = ''
    body = canonicalize_upload_urls_in_text(current_app.config, 'value_pick', raw_body.strip())

    if not competency:
        errors.append(f'competency는 1~{MAX_COMPETENCY_LENGTH}자여야 합니다.')
    if not pledge:
        errors.append(f'pledge는 1~{MAX_PLEDGE_LENGTH}자여야 합니다.')
    if len(body) > MAX_BODY_LENGTH:
        errors.append(f'body는 {MAX_BODY_LENGTH}자 이하여야 합니다.')

    return errors, {
        'competency': competency,
        'pledge': pledge,
        'body': body,
    }


def apply_filters(query, status, query_text, mine, user_id, user=None):
    """Apply list filters and role-based visibility constraints."""
    query = query.filter(ValuePickPost.deleted_at.is_(None))

    if status in {ValuePickStatus.PENDING.value, ValuePickStatus.PENDING}:
        query = query.filter(ValuePickPost.status == ValuePickStatus.PENDING)
    elif status in {ValuePickStatus.APPROVED.value, ValuePickStatus.APPROVED}:
        query = query.filter(ValuePickPost.status == ValuePickStatus.APPROVED)

    if query_text:
        pattern = f'%{query_text}%'
        query = query.filter(
            or_(
                ValuePickPost.competency.ilike(pattern),
                ValuePickPost.pledge.ilike(pattern),
                ValuePickPost.body.ilike(pattern),
            )
        )

    if mine and user_id:
        query = query.filter(ValuePickPost.author_id == user_id)

    if not is_admin(user):
        if user_id:
            query = query.filter(
                or_(
                    ValuePickPost.status == ValuePickStatus.APPROVED,
                    ValuePickPost.author_id == user_id,
                )
            )
        else:
            query = query.filter(ValuePickPost.status == ValuePickStatus.APPROVED)

    return query


def apply_sort(query, sort):
    """Apply supported sort mode for list endpoints."""
    if sort == 'comments':
        return query.order_by(ValuePickPost.comments_count.desc(), ValuePickPost.created_at.desc())
    if sort == 'likes':
        return query.order_by(ValuePickPost.like_count.desc(), ValuePickPost.created_at.desc())
    return query.order_by(ValuePickPost.created_at.desc())


def fetch_post_or_404(post_id):
    """Fetch non-deleted post with eager-loaded relations."""
    post = ValuePickPost.query.options(
        joinedload(ValuePickPost.author),
        joinedload(ValuePickPost.approved_by),
    ).filter_by(id=post_id).first()
    if not post or post.deleted_at:
        return None
    return post


@value_pick_bp.route('', methods=['GET'])
@value_pick_bp.route('/', methods=['GET'])
@cache_json_response('value_pick')
def list_posts():
    """
    List Value Pick posts with role-aware visibility.

    Non-admin users can view approved posts plus their own pending posts.
    """
    query_text = request.args.get('query') or request.args.get('q')
    sort = request.args.get('sort', 'recent')
    mine = parse_bool(request.args.get('mine'))
    status = request.args.get('status')
    view = request.args.get('view')
    page, page_size = parse_pagination(request, default_page_size=20, max_page_size=50)

    current_user_id = optional_current_user_id()
    current_user = db.session.get(User, current_user_id) if current_user_id else None

    if not is_admin(current_user):
        status = None

    query = ValuePickPost.query.options(
        joinedload(ValuePickPost.author),
        joinedload(ValuePickPost.approved_by),
    )
    query = apply_filters(query, status, query_text, mine, current_user_id, current_user)
    total = query.count()
    items = apply_sort(query, sort).offset((page - 1) * page_size).limit(page_size).all()

    reactions_map = {}
    if current_user_id:
        post_ids = [post.id for post in items]
        if post_ids:
            reactions = ValuePickReaction.query.filter(
                ValuePickReaction.user_id == current_user_id,
                ValuePickReaction.post_id.in_(post_ids),
            ).all()
            reactions_map = {reaction.post_id: reaction.type.value for reaction in reactions}

    return jsonify(
        build_paginated_response(
            [
                post.to_list_dict(my_reaction=reactions_map.get(post.id))
                if view == 'list'
                else post.to_dict(my_reaction=reactions_map.get(post.id))
                for post in items
            ],
            total,
            page,
            page_size,
        )
    )


@value_pick_bp.route('', methods=['POST'])
@value_pick_bp.route('/', methods=['POST'])
@jwt_required()
def create_post():
    """Create post in pending moderation state."""
    data = request.get_json() or {}
    errors, payload = validate_payload(data)
    if errors:
        return jsonify({'errors': errors}), 422

    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404

    post = ValuePickPost(
        competency=payload['competency'],
        pledge=payload['pledge'],
        body=payload['body'],
        status=ValuePickStatus.PENDING,
        author_id=user.id,
        author_role=user.role.value,
    )

    try:
        db.session.add(post)
        db.session.commit()
        invalidate_cache_namespaces('value_pick')
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '게시글 저장 중 오류가 발생했습니다.'}), 500

    return jsonify(post.to_dict()), 201


@value_pick_bp.route('/<int:post_id>', methods=['GET'])
@cache_json_response('value_pick')
def get_post(post_id):
    """Return one post with visibility checks for pending content."""
    post = fetch_post_or_404(post_id)
    if not post:
        return jsonify({'error': '게시글을 찾을 수 없습니다.'}), 404

    current_user_id = optional_current_user_id()
    current_user = db.session.get(User, current_user_id) if current_user_id else None
    if post.status != ValuePickStatus.APPROVED and not (
        is_admin(current_user) or (current_user and current_user.id == post.author_id)
    ):
        return jsonify({'error': '열람 권한이 없습니다.'}), 403

    my_reaction = None
    if current_user_id:
        reaction = ValuePickReaction.query.filter_by(post_id=post_id, user_id=current_user_id).first()
        if reaction:
            my_reaction = reaction.type.value

    try:
        post.views += 1
        db.session.commit()
        invalidate_cache_namespaces('value_pick')
    except SQLAlchemyError:
        db.session.rollback()

    return jsonify(post.to_dict(my_reaction=my_reaction))


@value_pick_bp.route('/<int:post_id>', methods=['PUT'])
@jwt_required()
def update_post(post_id):
    """Update post content when caller can edit."""
    post = fetch_post_or_404(post_id)
    if not post:
        return jsonify({'error': '게시글을 찾을 수 없습니다.'}), 404

    user = get_current_user()
    if not can_edit(post, user):
        return jsonify({'error': '수정 권한이 없습니다.'}), 403

    data = request.get_json() or {}
    errors, payload = validate_payload(data)
    if errors:
        return jsonify({'errors': errors}), 422

    post.competency = payload['competency']
    post.pledge = payload['pledge']
    post.body = payload['body']

    try:
        db.session.commit()
        invalidate_cache_namespaces('value_pick')
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '게시글 수정 중 오류가 발생했습니다.'}), 500

    return jsonify(post.to_dict())


@value_pick_bp.route('/<int:post_id>', methods=['DELETE'])
@jwt_required()
@require_role(UserRole.ADMIN)
def delete_post(post_id):
    """Soft-delete post (admin only)."""
    post = fetch_post_or_404(post_id)
    if not post:
        return jsonify({'error': '게시글을 찾을 수 없습니다.'}), 404

    try:
        post.deleted_at = db.func.now()
        db.session.commit()
        invalidate_cache_namespaces('value_pick')
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '게시글 삭제 중 오류가 발생했습니다.'}), 500

    return jsonify({'message': '삭제했습니다.'}), 200


@value_pick_bp.route('/<int:post_id>/approve', methods=['POST'])
@jwt_required()
@require_role(UserRole.ADMIN)
def approve_post(post_id):
    """Approve pending post and persist moderation metadata."""
    post = fetch_post_or_404(post_id)
    if not post:
        return jsonify({'error': '게시글을 찾을 수 없습니다.'}), 404

    post.status = ValuePickStatus.APPROVED
    post.approved_by_id = get_current_user().id
    post.approved_at = datetime.utcnow()
    try:
        db.session.commit()
        invalidate_cache_namespaces('value_pick')
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '승인 처리 중 오류가 발생했습니다.'}), 500
    return jsonify(post.to_dict())


@value_pick_bp.route('/<int:post_id>/unapprove', methods=['POST'])
@jwt_required()
@require_role(UserRole.ADMIN)
def unapprove_post(post_id):
    """Move post back to pending state."""
    post = fetch_post_or_404(post_id)
    if not post:
        return jsonify({'error': '게시글을 찾을 수 없습니다.'}), 404

    post.status = ValuePickStatus.PENDING
    post.approved_by_id = None
    post.approved_at = None
    try:
        db.session.commit()
        invalidate_cache_namespaces('value_pick')
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '승인 취소 중 오류가 발생했습니다.'}), 500
    return jsonify(post.to_dict())


@value_pick_bp.route('/<int:post_id>/reactions', methods=['POST'])
@jwt_required()
def react_post(post_id):
    """Toggle or switch post reaction while preserving counters."""
    post = fetch_post_or_404(post_id)
    if not post:
        return jsonify({'error': '게시글을 찾을 수 없습니다.'}), 404

    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    if post.status != ValuePickStatus.APPROVED and not (is_admin(user) or post.author_id == user.id):
        return jsonify({'error': '열람 권한이 없습니다.'}), 403

    data = request.get_json() or {}
    reaction_type = data.get('type')
    if reaction_type not in (ValuePickReactionType.LIKE.value, ValuePickReactionType.DISLIKE.value):
        return jsonify({'error': "type은 like 또는 dislike 이어야 합니다."}), 422

    existing = ValuePickReaction.query.filter_by(post_id=post_id, user_id=user.id).first()

    try:
        if existing and existing.type.value == reaction_type:
            if reaction_type == ValuePickReactionType.LIKE.value and post.like_count > 0:
                post.like_count -= 1
            if reaction_type == ValuePickReactionType.DISLIKE.value and post.dislike_count > 0:
                post.dislike_count -= 1
            db.session.delete(existing)
            my_reaction = None
        else:
            if existing:
                if existing.type == ValuePickReactionType.LIKE and post.like_count > 0:
                    post.like_count -= 1
                if existing.type == ValuePickReactionType.DISLIKE and post.dislike_count > 0:
                    post.dislike_count -= 1
                existing.type = ValuePickReactionType(reaction_type)
                my_reaction = reaction_type
            else:
                db.session.add(
                    ValuePickReaction(
                        post_id=post_id,
                        user_id=user.id,
                        type=ValuePickReactionType(reaction_type),
                    )
                )
                my_reaction = reaction_type

            if reaction_type == ValuePickReactionType.LIKE.value:
                post.like_count += 1
            else:
                post.dislike_count += 1

        db.session.commit()
        invalidate_cache_namespaces('value_pick')
    except (IntegrityError, SQLAlchemyError):
        db.session.rollback()
        return jsonify({'error': '반응 처리 중 오류가 발생했습니다.'}), 500

    return jsonify({
        'likes': post.like_count,
        'dislikes': post.dislike_count,
        'myReaction': my_reaction,
    })


@value_pick_bp.route('/<int:post_id>/comments', methods=['GET'])
@cache_json_response('value_pick')
def list_comments(post_id):
    """List comments with deterministic order and pagination."""
    post = fetch_post_or_404(post_id)
    if not post:
        return jsonify({'error': '게시글을 찾을 수 없습니다.'}), 404

    current_user_id = optional_current_user_id()
    current_user = db.session.get(User, current_user_id) if current_user_id else None
    if post.status != ValuePickStatus.APPROVED and not (
        is_admin(current_user) or (current_user and current_user.id == post.author_id)
    ):
        return jsonify({'error': '열람 권한이 없습니다.'}), 403

    page, page_size = parse_pagination(request)
    order = request.args.get('order', 'asc')
    query = ValuePickComment.query.options(
        joinedload(ValuePickComment.user),
    ).filter(
        ValuePickComment.post_id == post_id,
        ValuePickComment.deleted_at.is_(None),
    )
    total = query.count()
    if order == 'desc':
        query = query.order_by(ValuePickComment.created_at.desc())
    else:
        query = query.order_by(ValuePickComment.created_at.asc())
    items = query.offset((page - 1) * page_size).limit(page_size).all()

    return jsonify(
        build_paginated_response(
            [item.to_dict() for item in items],
            total,
            page,
            page_size,
        )
    )


@value_pick_bp.route('/<int:post_id>/comments', methods=['POST'])
@jwt_required()
def create_comment(post_id):
    """Create comment and increment post comments_count."""
    post = fetch_post_or_404(post_id)
    if not post:
        return jsonify({'error': '게시글을 찾을 수 없습니다.'}), 404

    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    if post.status != ValuePickStatus.APPROVED and not (is_admin(user) or post.author_id == user.id):
        return jsonify({'error': '열람 권한이 없습니다.'}), 403

    data = request.get_json() or {}
    body = sanitize_plain_text(data.get('body', ''), max_length=1000)
    if not body:
        return jsonify({'error': '댓글은 1~1000자여야 합니다.'}), 422

    comment = ValuePickComment(post_id=post_id, user_id=user.id, body=body)

    try:
        db.session.add(comment)
        post.comments_count += 1
        db.session.commit()
        invalidate_cache_namespaces('value_pick')
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '댓글 작성 중 오류가 발생했습니다.'}), 500

    return jsonify(comment.to_dict()), 201


@value_pick_bp.route('/<int:post_id>/comments/<int:comment_id>', methods=['DELETE'])
@jwt_required()
@require_role(UserRole.ADMIN)
def delete_comment(post_id, comment_id):
    """Soft-delete comment and decrement post comments_count."""
    comment = ValuePickComment.query.filter_by(id=comment_id, post_id=post_id).first()
    if not comment or comment.deleted_at:
        return jsonify({'error': '댓글을 찾을 수 없습니다.'}), 404

    try:
        comment.deleted_at = db.func.now()
        post = db.session.get(ValuePickPost, post_id)
        if post and post.comments_count > 0:
            post.comments_count -= 1
        db.session.commit()
        invalidate_cache_namespaces('value_pick')
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '댓글 삭제 중 오류가 발생했습니다.'}), 500

    return jsonify({'message': '삭제했습니다.'}), 200


@value_pick_bp.route('/uploads', methods=['POST'])
@value_pick_bp.route('/uploads/', methods=['POST'])
@jwt_required()
def upload_file():
    """Validate and store upload for Value Pick editor files."""
    if 'file' not in request.files:
        return jsonify({'error': 'file 필드가 필요합니다.'}), 400
    file = request.files['file']

    result = validate_upload(file, current_app.config, require_image=False)
    if not result.get('ok'):
        return jsonify({'error': result.get('error', '파일 검증에 실패했습니다.')}), 422

    saved = save_upload_for_scope(file, current_app.config, 'value_pick')
    canonical_url = saved['url']
    preview_url = build_upload_preview_url(current_app.config, 'value_pick', saved['filename'])

    return jsonify({
        'id': saved['filename'],
        'name': result['name'],
        'size': result['size'],
        'url': preview_url,
        'canonicalUrl': canonical_url,
        'mime': result['mime'],
        'kind': result['kind'],
    }), 201


@value_pick_bp.route('/uploads/<path:filename>', methods=['GET'], strict_slashes=False)
def serve_upload(filename):
    """Serve upload with post-level visibility and temporary-file fallback."""
    resolved_upload = resolve_upload_path_for_scope(current_app.config, 'value_pick', filename)
    if not resolved_upload:
        return jsonify({'error': '첨부파일을 찾을 수 없습니다.'}), 404

    upload_dir = resolved_upload['upload_dir']
    ensure_dir(upload_dir)
    safe_filename = resolved_upload['filename']
    file_path = resolved_upload['path']
    attachment_url = build_upload_url(current_app.config, 'value_pick', safe_filename)
    post = ValuePickPost.query.filter(
        ValuePickPost.deleted_at.is_(None),
        ValuePickPost.body.ilike(f'%{attachment_url}%'),
    ).first()

    if not post:
        if not file_path.exists():
            return jsonify({'error': '첨부파일을 찾을 수 없습니다.'}), 404
        preview_token = request.args.get('preview_token', '')
        if not is_valid_upload_preview_token(
            current_app.config,
            'value_pick',
            safe_filename,
            preview_token,
        ):
            return jsonify({'error': '첨부파일을 찾을 수 없습니다.'}), 404

        ext = Path(safe_filename).suffix.lower()
        inline_exts = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}
        response = send_from_directory(
            upload_dir,
            safe_filename,
            as_attachment=ext not in inline_exts,
            download_name=safe_filename,
        )
        response.headers['X-Content-Type-Options'] = 'nosniff'
        return response

    current_user_id = optional_current_user_id()
    current_user = db.session.get(User, current_user_id) if current_user_id else None
    if post.status != ValuePickStatus.APPROVED and not (
        is_admin(current_user) or (current_user and current_user.id == post.author_id)
    ):
        return jsonify({'error': '열람 권한이 없습니다.'}), 403

    ext = Path(safe_filename).suffix.lower()
    inline_exts = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}
    response = send_from_directory(
        upload_dir,
        safe_filename,
        as_attachment=ext not in inline_exts,
        download_name=safe_filename,
    )
    response.headers['X-Content-Type-Options'] = 'nosniff'
    return response
