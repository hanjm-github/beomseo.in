"""
Notice, attachment, comment, and reaction routes.
"""
from flask import Blueprint, request, jsonify, current_app, send_from_directory
from flask_jwt_extended import (
    jwt_required,
    get_jwt_identity,
    verify_jwt_in_request,
)
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import or_

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
)
from utils.pagination import parse_pagination
from utils.files import save_upload, ensure_dir
from utils.security import require_role, get_current_user

notices_bp = Blueprint('notices', __name__, url_prefix='/api/notices')


def parse_bool(val):
    if val is None:
        return None
    return str(val).lower() in {'1', 'true', 'yes', 'on'}


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


@notices_bp.route('/', methods=['GET'])
@notices_bp.route('', methods=['GET'])
def list_notices():
    category = request.args.get('category')
    query_text = request.args.get('query')
    pinned = parse_bool(request.args.get('pinned'))
    important = parse_bool(request.args.get('important'))
    exam = parse_bool(request.args.get('exam'))
    sort = request.args.get('sort', 'recent')
    tags = request.args.get('tags')
    page, page_size = parse_pagination(request)

    q = Notice.query
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

    return jsonify({
        'items': [n.to_dict(my_reaction=reactions_map.get(n.id)) for n in items],
        'total': total,
        'page': page,
        'page_size': page_size
    })


def apply_filters(query, category, query_text, pinned, important, exam, tags=None):
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
                Notice.summary.ilike(pattern)
            )
        )
    if tags:
        if isinstance(tags, str):
            tags_list = [t.strip() for t in tags.split(',') if t.strip()]
        else:
            tags_list = tags
        for tag in tags_list or []:
            query = query.filter(Notice.tags.ilike(f"%{tag}%"))
    query = query.filter(Notice.deleted_at.is_(None))
    return query


def apply_sort(query, sort):
    if sort == 'views':
        return query.order_by(Notice.pinned.desc(), Notice.views.desc(), Notice.created_at.desc())
    if sort == 'important':
        return query.order_by(Notice.pinned.desc(), Notice.important.desc(), Notice.created_at.desc())
    return query.order_by(Notice.pinned.desc(), Notice.created_at.desc())


def validate_notice_payload(data, is_update=False):
    errors = []
    title = (data.get('title') or '').strip()
    body = (data.get('body') or '').strip()
    category = data.get('category')
    tags = data.get('tags') or []
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
    for a in attachments:
        if a.get('size', 0) > max_size:
            errors.append(f'첨부파일 용량은 10MB 이하만 가능합니다.')
            break

    return errors, {
        'title': title,
        'body': body,
        'category': category,
        'tags': tags,
        'pinned': pinned,
        'important': important,
        'exam_related': exam_related,
        'attachments': attachments,
    }


def map_category(cat_str):
    if cat_str == NoticeCategory.COUNCIL.value:
        return NoticeCategory.COUNCIL
    return NoticeCategory.SCHOOL


@notices_bp.route('/', methods=['POST'])
@notices_bp.route('', methods=['POST'])
@jwt_required()
@require_role(UserRole.STUDENT_COUNCIL, UserRole.ADMIN)
def create_notice():
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
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '공지 저장 중 오류가 발생했습니다.'}), 500

    return jsonify(notice.to_dict()), 201


def ensure_edit_permission(notice, user):
    if user.role == UserRole.ADMIN:
        return True
    if user.role == UserRole.STUDENT_COUNCIL and notice.author_id == user.id:
        return True
    return False


@notices_bp.route('/<int:notice_id>', methods=['PUT'])
@jwt_required()
def update_notice(notice_id):
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
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '공지 수정 중 오류가 발생했습니다.'}), 500

    return jsonify(notice.to_dict())


@notices_bp.route('/<int:notice_id>', methods=['DELETE'])
@jwt_required()
def delete_notice(notice_id):
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
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '공지 삭제 중 오류가 발생했습니다.'}), 500

    return jsonify({'message': '삭제되었습니다.'}), 200


@notices_bp.route('/<int:notice_id>', methods=['GET'])
def get_notice(notice_id):
    notice = Notice.query.get(notice_id)
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


@notices_bp.route('/uploads/<path:filename>', methods=['GET'])
@notices_bp.route('/uploads/<path:filename>/', methods=['GET'])
def serve_upload(filename):
    upload_dir = current_app.config.get('UPLOAD_DIR', './uploads')
    ensure_dir(upload_dir)
    # Try to recover original name for Content-Disposition
    attachment = Attachment.query.filter(Attachment.url.like(f"%/{filename}")).first()
    download_name = attachment.name if attachment else filename
    return send_from_directory(
        upload_dir,
        filename,
        as_attachment=True,
        download_name=download_name
    )


# ----- Comments -----


@notices_bp.route('/<int:notice_id>/comments', methods=['GET'])
def list_comments(notice_id):
    notice = Notice.query.get(notice_id)
    if not notice or notice.deleted_at:
        return jsonify({'error': '공지 를 찾을 수 없습니다.'}), 404

    page, page_size = parse_pagination(request)
    order = request.args.get('order', 'asc')
    q = Comment.query.filter(
        Comment.notice_id == notice_id,
        Comment.deleted_at.is_(None)
    )
    total = q.count()
    if order == 'desc':
        q = q.order_by(Comment.created_at.desc())
    else:
        q = q.order_by(Comment.created_at.asc())
    items = q.offset((page - 1) * page_size).limit(page_size).all()

    return jsonify({
        'items': [c.to_dict() for c in items],
        'total': total,
        'page': page,
        'page_size': page_size
    })


@notices_bp.route('/<int:notice_id>/comments', methods=['POST'])
@jwt_required()
def create_comment(notice_id):
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
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '댓글 작성 중 오류가 발생했습니다.'}), 500

    return jsonify(comment.to_dict()), 201


@notices_bp.route('/<int:notice_id>/comments/<int:comment_id>', methods=['DELETE'])
@jwt_required()
@require_role(UserRole.ADMIN)
def delete_comment(notice_id, comment_id):
    comment = Comment.query.filter_by(id=comment_id, notice_id=notice_id).first()
    if not comment or comment.deleted_at:
        return jsonify({'error': '댓글을 찾을 수 없습니다.'}), 404

    try:
        comment.deleted_at = db.func.now()
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '댓글 삭제 중 오류가 발생했습니다.'}), 500

    return jsonify({'message': '삭제되었습니다.'}), 200


# ----- Reactions -----


@notices_bp.route('/<int:notice_id>/reactions', methods=['POST'])
@jwt_required()
def react_notice(notice_id):
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
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '리액션 처리 중 오류가 발생했습니다.'}), 500

    return jsonify({
        'likes': notice.like_count,
        'dislikes': notice.dislike_count,
        'myReaction': my_reaction
    })
