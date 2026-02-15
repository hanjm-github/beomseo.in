"""
Free board routes with approval workflow.
"""
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app, send_from_directory
from flask_jwt_extended import (
    jwt_required,
    get_jwt_identity,
    verify_jwt_in_request,
)
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from sqlalchemy import or_

from models import (
    db,
    User,
    UserRole,
    FreePost,
    FreeAttachment,
    FreeReaction,
    FreeReactionType,
    FreeComment,
    FreeBookmark,
    FreeCategory,
    FreeStatus,
)
from utils.pagination import parse_pagination
from utils.files import save_upload, ensure_dir
from utils.security import require_role, get_current_user

free_bp = Blueprint('free', __name__, url_prefix='/api/community/free')


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


def validate_payload(data, is_update=False):
    errors = []
    title = (data.get('title') or '').strip()
    body = (data.get('body') or '').strip()
    category = data.get('category')
    attachments = data.get('attachments') or []

    if not title or len(title) < 2 or len(title) > 200:
        errors.append('제목은 2~200자로 입력해주세요.')
    if not body:
        errors.append('본문은 필수입니다.')
    if category not in (FreeCategory.CHAT.value, FreeCategory.INFO.value, FreeCategory.QNA.value):
        errors.append('category는 chat, info, qna 중 하나여야 합니다.')

    max_attach = current_app.config.get('MAX_ATTACH_COUNT', 5)
    max_size = current_app.config.get('MAX_ATTACH_SIZE', 10 * 1024 * 1024)
    if len(attachments) > max_attach:
        errors.append(f'첨부파일은 최대 {max_attach}개까지 가능합니다.')
    for a in attachments:
        if a.get('size', 0) > max_size:
            errors.append('첨부파일 용량은 10MB 이하만 가능합니다.')
            break

    return errors, {
        'title': title,
        'body': body,
        'category': category,
        'attachments': attachments,
    }


def is_admin(user: User):
    return user and user.role == UserRole.ADMIN


def can_edit(post: FreePost, user: User):
    if is_admin(user):
        return True
    return user and post.author_id == user.id and not post.deleted_at


@free_bp.route('/', methods=['GET'])
@free_bp.route('', methods=['GET'])
def list_posts():
    category = request.args.get('category')
    query_text = request.args.get('query')
    sort = request.args.get('sort', 'recent')
    mine = parse_bool(request.args.get('mine'))
    bookmarked = parse_bool(request.args.get('bookmarked'))
    status = request.args.get('status')  # admin only: pending|approved|all
    page, page_size = parse_pagination(request, default_page_size=10, max_page_size=50)

    current_user_id = optional_current_user_id()
    current_user = User.query.get(current_user_id) if current_user_id else None
    is_admin_user = is_admin(current_user)

    if not is_admin_user:
        status = FreeStatus.APPROVED.value
        mine = None if mine is None else mine

    q = FreePost.query
    q = apply_filters(q, category, status, query_text, mine, bookmarked, current_user_id)
    total = q.count()
    q = apply_sort(q, sort)
    items = q.offset((page - 1) * page_size).limit(page_size).all()

    reactions_map = {}
    bookmarks_map = {}
    if current_user_id:
        post_ids = [p.id for p in items]
        if post_ids:
            reactions = FreeReaction.query.filter(
                FreeReaction.user_id == current_user_id,
                FreeReaction.post_id.in_(post_ids)
            ).all()
            reactions_map = {r.post_id: r.type.value for r in reactions}
            bookmarked_ids = [b.post_id for b in FreeBookmark.query.filter(
                FreeBookmark.user_id == current_user_id,
                FreeBookmark.post_id.in_(post_ids)
            ).all()]
            bookmarks_map = {pid: True for pid in bookmarked_ids}

    return jsonify({
        'items': [p.to_dict(my_reaction=reactions_map.get(p.id), bookmarked=bookmarks_map.get(p.id, False)) for p in items],
        'total': total,
        'page': page,
        'page_size': page_size
    })


def apply_filters(query, category, status, query_text, mine, bookmarked, user_id):
    query = query.filter(FreePost.deleted_at.is_(None))
    if category in {FreeCategory.CHAT.value, FreeCategory.CHAT}:
        query = query.filter(FreePost.category == FreeCategory.CHAT)
    elif category in {FreeCategory.INFO.value, FreeCategory.INFO}:
        query = query.filter(FreePost.category == FreeCategory.INFO)
    elif category in {FreeCategory.QNA.value, FreeCategory.QNA}:
        query = query.filter(FreePost.category == FreeCategory.QNA)

    if status in {FreeStatus.PENDING.value, FreeStatus.PENDING}:
        query = query.filter(FreePost.status == FreeStatus.PENDING)
    elif status in {FreeStatus.APPROVED.value, FreeStatus.APPROVED}:
        query = query.filter(FreePost.status == FreeStatus.APPROVED)
    # status == all -> no filter

    if query_text:
        pattern = f"%{query_text}%"
        query = query.filter(or_(FreePost.title.ilike(pattern), FreePost.body.ilike(pattern), FreePost.summary.ilike(pattern)))
    if mine and user_id:
        query = query.filter(FreePost.author_id == user_id)
    if bookmarked and user_id:
        query = query.join(FreeBookmark).filter(FreeBookmark.user_id == user_id)
    return query


def apply_sort(query, sort):
    if sort == 'comments':
        return query.order_by(FreePost.comments_count.desc(), FreePost.created_at.desc())
    if sort == 'likes':
        return query.order_by(FreePost.like_count.desc(), FreePost.created_at.desc())
    return query.order_by(FreePost.created_at.desc())


@free_bp.route('/', methods=['POST'])
@free_bp.route('', methods=['POST'])
@jwt_required()
def create_post():
    data = request.get_json() or {}
    errors, payload = validate_payload(data)
    if errors:
        return jsonify({'errors': errors}), 422

    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404

    post = FreePost(
        category=FreeCategory(payload['category']),
        title=payload['title'],
        body=payload['body'],
        summary=data.get('summary') or FreePost.summarize(payload['body']),
        status=FreeStatus.PENDING,
        author_id=user.id,
        author_role=user.role.value,
    )

    for a in payload['attachments']:
        post.attachments.append(
            FreeAttachment(
                name=a.get('name'),
                url=a.get('url'),
                mime=a.get('mime'),
                size=a.get('size'),
                kind=a.get('kind', 'file'),
            )
        )

    try:
        db.session.add(post)
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '게시글 저장 중 오류가 발생했습니다.'}), 500

    return jsonify(post.to_dict()), 201


def fetch_post_or_404(post_id):
    post = FreePost.query.get(post_id)
    if not post or post.deleted_at:
        return None
    return post


@free_bp.route('/<int:post_id>', methods=['PUT'])
@jwt_required()
def update_post(post_id):
    post = fetch_post_or_404(post_id)
    if not post:
        return jsonify({'error': '게시글을 찾을 수 없습니다.'}), 404

    user = get_current_user()
    if not can_edit(post, user):
        return jsonify({'error': '수정 권한이 없습니다.'}), 403

    data = request.get_json() or {}
    errors, payload = validate_payload(data, is_update=True)
    if errors:
        return jsonify({'errors': errors}), 422

    post.title = payload['title']
    post.body = payload['body']
    post.summary = data.get('summary') or FreePost.summarize(payload['body'])
    post.category = FreeCategory(payload['category'])

    post.attachments = []
    for a in payload['attachments']:
        post.attachments.append(
            FreeAttachment(
                name=a.get('name'),
                url=a.get('url'),
                mime=a.get('mime'),
                size=a.get('size'),
                kind=a.get('kind', 'file'),
            )
        )

    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '게시글 수정 중 오류가 발생했습니다.'}), 500

    return jsonify(post.to_dict())


@free_bp.route('/<int:post_id>', methods=['DELETE'])
@jwt_required()
def delete_post(post_id):
    post = fetch_post_or_404(post_id)
    if not post:
        return jsonify({'error': '게시글을 찾을 수 없습니다.'}), 404

    user = get_current_user()
    if not is_admin(user):
        return jsonify({'error': '삭제 권한이 없습니다.'}), 403

    try:
        post.deleted_at = db.func.now()
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '게시글 삭제 중 오류가 발생했습니다.'}), 500

    return jsonify({'message': '삭제되었습니다.'}), 200


@free_bp.route('/<int:post_id>', methods=['GET'])
def get_post(post_id):
    post = fetch_post_or_404(post_id)
    if not post:
        return jsonify({'error': '게시글을 찾을 수 없습니다.'}), 404

    current_user_id = optional_current_user_id()
    current_user = User.query.get(current_user_id) if current_user_id else None
    if post.status != FreeStatus.APPROVED and not (is_admin(current_user) or (current_user and current_user.id == post.author_id)):
        return jsonify({'error': '열람 권한이 없습니다.'}), 403

    my_reaction = None
    bookmarked = False
    if current_user_id:
        reaction = FreeReaction.query.filter_by(post_id=post_id, user_id=current_user_id).first()
        if reaction:
            my_reaction = reaction.type.value
        bookmarked = FreeBookmark.query.filter_by(post_id=post_id, user_id=current_user_id).first() is not None

    try:
        post.views += 1
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()

    return jsonify(post.to_dict(my_reaction=my_reaction, bookmarked=bookmarked))


@free_bp.route('/<int:post_id>/approve', methods=['POST'])
@jwt_required()
@require_role(UserRole.ADMIN)
def approve_post(post_id):
    post = fetch_post_or_404(post_id)
    if not post:
        return jsonify({'error': '게시글을 찾을 수 없습니다.'}), 404

    post.status = FreeStatus.APPROVED
    post.approved_by_id = get_current_user().id
    post.approved_at = datetime.utcnow()
    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '승인 처리 중 오류가 발생했습니다.'}), 500
    return jsonify(post.to_dict())


@free_bp.route('/<int:post_id>/unapprove', methods=['POST'])
@jwt_required()
@require_role(UserRole.ADMIN)
def unapprove_post(post_id):
    post = fetch_post_or_404(post_id)
    if not post:
        return jsonify({'error': '게시글을 찾을 수 없습니다.'}), 404

    post.status = FreeStatus.PENDING
    post.approved_by_id = None
    post.approved_at = None
    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '승인 취소 중 오류가 발생했습니다.'}), 500
    return jsonify(post.to_dict())


@free_bp.route('/<int:post_id>/reactions', methods=['POST'])
@jwt_required()
def react_post(post_id):
    post = fetch_post_or_404(post_id)
    if not post:
        return jsonify({'error': '게시글을 찾을 수 없습니다.'}), 404

    data = request.get_json() or {}
    reaction_type = data.get('type')
    if reaction_type not in (FreeReactionType.LIKE.value, FreeReactionType.DISLIKE.value):
        return jsonify({'error': 'type은 like 또는 dislike 이어야 합니다.'}), 422

    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404

    existing = FreeReaction.query.filter_by(post_id=post_id, user_id=user.id).first()

    try:
        if existing and existing.type.value == reaction_type:
            if reaction_type == FreeReactionType.LIKE.value and post.like_count > 0:
                post.like_count -= 1
            if reaction_type == FreeReactionType.DISLIKE.value and post.dislike_count > 0:
                post.dislike_count -= 1
            db.session.delete(existing)
            my_reaction = None
        else:
            if existing:
                if existing.type == FreeReactionType.LIKE and post.like_count > 0:
                    post.like_count -= 1
                if existing.type == FreeReactionType.DISLIKE and post.dislike_count > 0:
                    post.dislike_count -= 1
                existing.type = FreeReactionType(reaction_type)
                my_reaction = reaction_type
            else:
                new_reaction = FreeReaction(post_id=post_id, user_id=user.id, type=FreeReactionType(reaction_type))
                db.session.add(new_reaction)
                my_reaction = reaction_type

            if reaction_type == FreeReactionType.LIKE.value:
                post.like_count += 1
            else:
                post.dislike_count += 1

        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '리액션 처리 중 오류가 발생했습니다.'}), 500

    return jsonify({
        'likes': post.like_count,
        'dislikes': post.dislike_count,
        'myReaction': my_reaction
    })


@free_bp.route('/<int:post_id>/bookmark', methods=['POST'])
@jwt_required()
def toggle_bookmark(post_id):
    post = fetch_post_or_404(post_id)
    if not post:
        return jsonify({'error': '게시글을 찾을 수 없습니다.'}), 404

    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404

    existing = FreeBookmark.query.filter_by(post_id=post_id, user_id=user.id).first()
    try:
        if existing:
            db.session.delete(existing)
            if post.bookmarked_count > 0:
                post.bookmarked_count -= 1
            bookmarked = False
        else:
            db.session.add(FreeBookmark(post_id=post_id, user_id=user.id))
            post.bookmarked_count += 1
            bookmarked = True
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({'error': '북마크 처리 중 오류가 발생했습니다.'}), 500
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '북마크 처리 중 오류가 발생했습니다.'}), 500

    return jsonify({'bookmarked': bookmarked, 'bookmarkedCount': post.bookmarked_count})


# ----- Comments -----


@free_bp.route('/<int:post_id>/comments', methods=['GET'])
def list_comments(post_id):
    post = fetch_post_or_404(post_id)
    if not post:
        return jsonify({'error': '게시글을 찾을 수 없습니다.'}), 404

    page, page_size = parse_pagination(request)
    order = request.args.get('order', 'asc')
    q = FreeComment.query.filter(FreeComment.post_id == post_id, FreeComment.deleted_at.is_(None))
    total = q.count()
    if order == 'desc':
        q = q.order_by(FreeComment.created_at.desc())
    else:
        q = q.order_by(FreeComment.created_at.asc())
    items = q.offset((page - 1) * page_size).limit(page_size).all()

    return jsonify({
        'items': [c.to_dict() for c in items],
        'total': total,
        'page': page,
        'page_size': page_size
    })


@free_bp.route('/<int:post_id>/comments', methods=['POST'])
@jwt_required()
def create_comment(post_id):
    post = fetch_post_or_404(post_id)
    if not post:
        return jsonify({'error': '게시글을 찾을 수 없습니다.'}), 404

    data = request.get_json() or {}
    body = (data.get('body') or '').strip()
    if not body or len(body) < 1 or len(body) > 1000:
        return jsonify({'error': '댓글은 1~1000자로 입력해주세요.'}), 422

    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404

    comment = FreeComment(post_id=post_id, user_id=user.id, body=body)

    try:
        db.session.add(comment)
        post.comments_count += 1
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '댓글 작성 중 오류가 발생했습니다.'}), 500

    return jsonify(comment.to_dict()), 201


@free_bp.route('/<int:post_id>/comments/<int:comment_id>', methods=['DELETE'])
@jwt_required()
@require_role(UserRole.ADMIN)
def delete_comment(post_id, comment_id):
    comment = FreeComment.query.filter_by(id=comment_id, post_id=post_id).first()
    if not comment or comment.deleted_at:
        return jsonify({'error': '댓글을 찾을 수 없습니다.'}), 404

    try:
        comment.deleted_at = db.func.now()
        post = FreePost.query.get(post_id)
        if post and post.comments_count > 0:
            post.comments_count -= 1
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '댓글 삭제 중 오류가 발생했습니다.'}), 500

    return jsonify({'message': '삭제되었습니다.'}), 200


# ----- Uploads -----


@free_bp.route('/uploads', methods=['POST'])
@free_bp.route('/uploads/', methods=['POST'])
@jwt_required()
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'file 필드가 필요합니다.'}), 400
    file = request.files['file']
    if not file.filename:
        return jsonify({'error': '파일 이름이 없습니다.'}), 400

    max_size = current_app.config.get('MAX_ATTACH_SIZE', 10 * 1024 * 1024)
    file.seek(0, 2)
    size = file.tell()
    file.seek(0)
    if size > max_size:
        return jsonify({'error': '첨부파일 용량은 10MB 이하만 가능합니다.'}), 422

    upload_dir = current_app.config.get('UPLOAD_DIR', './uploads')
    upload_dir = f"{upload_dir}/free"
    upload_base_url = current_app.config.get('UPLOAD_BASE_URL')
    saved = save_upload(file, upload_dir, upload_base_url)
    kind = 'image' if (file.mimetype or '').startswith('image/') else 'file'

    return jsonify({
        'id': saved['filename'],
        'name': file.filename,
        'size': size,
        'url': saved['url'],
        'mime': file.mimetype,
        'kind': kind
    }), 201


@free_bp.route('/uploads/<path:filename>', methods=['GET'])
@free_bp.route('/uploads/<path:filename>/', methods=['GET'])
def serve_upload(filename):
    upload_dir = current_app.config.get('UPLOAD_DIR', './uploads')
    upload_dir = f"{upload_dir}/free"
    ensure_dir(upload_dir)
    attachment = FreeAttachment.query.filter(FreeAttachment.url.like(f"%/{filename}")).first()
    download_name = attachment.name if attachment else filename
    return send_from_directory(upload_dir, filename, as_attachment=True, download_name=download_name)
