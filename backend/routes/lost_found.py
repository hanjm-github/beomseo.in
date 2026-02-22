"""
Lost & Found board routes.
"""
from datetime import datetime, timezone
from pathlib import Path

from flask import Blueprint, request, jsonify, current_app, send_from_directory
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from sqlalchemy import or_
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import joinedload, selectinload

from models import (
    db,
    User,
    UserRole,
    LostFoundPost,
    LostFoundImage,
    LostFoundComment,
    LostFoundStatus,
    LostFoundCategory,
)
from utils.pagination import parse_pagination, build_paginated_response
from utils.files import (
    build_upload_preview_url,
    save_upload_for_scope,
    resolve_scope_upload_dir,
    ensure_dir,
    build_upload_url,
    is_valid_upload_preview_token,
    validate_upload,
    extract_upload_filename_for_scope,
)
from utils.security import require_role, get_current_user
from utils.cache import cache_json_response, invalidate_cache_namespaces

lost_found_bp = Blueprint('lost_found', __name__, url_prefix='/api/community/lost-found')


def optional_current_user():
    """Return authenticated user when token exists; otherwise None."""
    try:
        verify_jwt_in_request(optional=True)
        user_id = get_jwt_identity()
        return User.query.get(int(user_id)) if user_id else None
    except Exception:
        return None


def parse_iso_datetime(value):
    """Parse ISO datetime and normalize timezone-aware values to UTC-naive."""
    if value in (None, ''):
        return None

    text = str(value).strip()
    if not text:
        return None

    if text.endswith('Z'):
        text = f'{text[:-1]}+00:00'

    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None

    if parsed.tzinfo is not None:
        parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed


def fetch_post_or_404(post_id):
    """Fetch non-deleted lost-found post with author/images eager-loaded."""
    return LostFoundPost.query.options(
        joinedload(LostFoundPost.author),
        selectinload(LostFoundPost.images),
    ).filter(
        LostFoundPost.id == post_id,
        LostFoundPost.deleted_at.is_(None),
    ).first()


def validate_create_payload(data):
    """
    Validate lost-found payload including image ownership checks.

    Uploaded image URLs must belong to the lost_found scope and exist on disk.
    """
    errors = []
    max_attach_count = int(current_app.config.get('MAX_ATTACH_COUNT', 5))
    max_attach_size = int(current_app.config.get('MAX_ATTACH_SIZE', 10 * 1024 * 1024))
    upload_dir = Path(resolve_scope_upload_dir(current_app.config, 'lost_found'))

    title = (data.get('title') or '').strip()
    description = (data.get('description') or '').strip()
    status = (data.get('status') or LostFoundStatus.SEARCHING.value).strip()
    category = (data.get('category') or LostFoundCategory.ETC.value).strip()
    found_at = parse_iso_datetime(data.get('foundAt') or data.get('found_at'))
    found_location = (data.get('foundLocation') or data.get('found_location') or '').strip()
    storage_location = (data.get('storageLocation') or data.get('storage_location') or '').strip()
    images = data.get('images') or []

    if not 2 <= len(title) <= 120:
        errors.append('제목은 2~120자로 입력해주세요.')
    if not 1 <= len(description) <= 2000:
        errors.append('설명은 1~2000자로 입력해주세요.')
    if status not in {item.value for item in LostFoundStatus}:
        errors.append('status는 searching 또는 found 이어야 합니다.')
    if category not in {item.value for item in LostFoundCategory}:
        errors.append('유효하지 않은 카테고리입니다.')
    if found_at is None:
        errors.append('습득일시 형식이 올바르지 않습니다.')
    if not 1 <= len(found_location) <= 200:
        errors.append('습득장소는 1~200자로 입력해주세요.')
    if not 1 <= len(storage_location) <= 200:
        errors.append('보관장소는 1~200자로 입력해주세요.')
    if not isinstance(images, list):
        errors.append('images는 배열이어야 합니다.')
        images = []
    if not 1 <= len(images) <= max_attach_count:
        errors.append(f'이미지는 최소 1개, 최대 {max_attach_count}개까지 등록할 수 있습니다.')

    normalized_images = []
    for index, image in enumerate(images):
        if not isinstance(image, dict):
            errors.append('이미지 형식이 올바르지 않습니다.')
            continue

        filename = extract_upload_filename_for_scope(current_app.config, 'lost_found', image.get('url'))
        if not filename:
            errors.append('이미지 URL이 올바르지 않습니다.')
            continue

        file_path = upload_dir / filename
        if not file_path.exists():
            errors.append('업로드되지 않은 이미지는 등록할 수 없습니다.')
            continue

        size = image.get('size')
        if size is not None:
            try:
                size = int(size)
            except (TypeError, ValueError):
                size = None
            if size is not None and size > max_attach_size:
                errors.append('이미지 용량은 10MB 이하만 가능합니다.')
                continue

        mime = str(image.get('mime') or '')
        if mime and not mime.lower().startswith('image/'):
            errors.append('이미지 MIME 타입이 올바르지 않습니다.')
            continue

        normalized_images.append(
            {
                'name': str(image.get('name') or filename)[:255],
                'url': build_upload_url(current_app.config, 'lost_found', filename),
                'mime': mime or None,
                'size': size,
                'kind': 'image',
                'display_order': index,
            }
        )

    return errors, {
        'title': title,
        'description': description,
        'status': status,
        'category': category,
        'found_at': found_at,
        'found_location': found_location,
        'storage_location': storage_location,
        'images': normalized_images,
    }


@lost_found_bp.route('', methods=['GET'])
@lost_found_bp.route('/', methods=['GET'])
@cache_json_response('lost_found')
def list_posts():
    """List lost-found posts with filter/sort/pagination controls."""
    # Optional auth read is kept for parity with other boards.
    optional_current_user()

    status = request.args.get('status')
    category = request.args.get('category')
    q_text = (request.args.get('q') or request.args.get('query') or '').strip()
    sort = request.args.get('sort', 'recent')
    view = request.args.get('view')
    page, page_size = parse_pagination(request, default_page_size=12, max_page_size=50)

    query = LostFoundPost.query.options(
        joinedload(LostFoundPost.author),
        selectinload(LostFoundPost.images),
    ).filter(LostFoundPost.deleted_at.is_(None))

    if status in {item.value for item in LostFoundStatus}:
        query = query.filter(LostFoundPost.status == LostFoundStatus(status))
    if category in {item.value for item in LostFoundCategory}:
        query = query.filter(LostFoundPost.category == LostFoundCategory(category))
    if q_text:
        pattern = f'%{q_text}%'
        query = query.filter(
            or_(
                LostFoundPost.title.ilike(pattern),
                LostFoundPost.description.ilike(pattern),
                LostFoundPost.found_location.ilike(pattern),
                LostFoundPost.storage_location.ilike(pattern),
            )
        )

    if sort == 'foundAt-desc':
        query = query.order_by(LostFoundPost.found_at.desc(), LostFoundPost.created_at.desc())
    elif sort == 'foundAt-asc':
        query = query.order_by(LostFoundPost.found_at.asc(), LostFoundPost.created_at.desc())
    else:
        query = query.order_by(LostFoundPost.created_at.desc())

    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return jsonify(
        build_paginated_response(
            [item.to_list_dict() if view == 'list' else item.to_dict() for item in items],
            total,
            page,
            page_size,
        )
    )


@lost_found_bp.route('/<int:post_id>', methods=['GET'])
def get_post(post_id):
    """Return post detail and best-effort increment view count."""
    post = fetch_post_or_404(post_id)
    if not post:
        return jsonify({'error': '게시글을 찾을 수 없습니다.'}), 404

    try:
        post.views = (post.views or 0) + 1
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()

    return jsonify(post.to_dict())


@lost_found_bp.route('', methods=['POST'])
@lost_found_bp.route('/', methods=['POST'])
@jwt_required()
@require_role(UserRole.ADMIN, UserRole.STUDENT_COUNCIL)
def create_post():
    """Create lost-found post (admin/student-council only)."""
    data = request.get_json() or {}
    errors, payload = validate_create_payload(data)
    if errors:
        return jsonify({'errors': errors}), 422

    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404

    post = LostFoundPost(
        title=payload['title'],
        description=payload['description'],
        status=LostFoundStatus(payload['status']),
        category=LostFoundCategory(payload['category']),
        found_at=payload['found_at'],
        found_location=payload['found_location'],
        storage_location=payload['storage_location'],
        author_id=user.id,
        author_role=user.role.value,
    )
    for image in payload['images']:
        post.images.append(
            LostFoundImage(
                name=image['name'],
                url=image['url'],
                mime=image['mime'],
                size=image['size'],
                kind=image['kind'],
                display_order=image['display_order'],
            )
        )

    try:
        db.session.add(post)
        db.session.commit()
        invalidate_cache_namespaces('lost_found')
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '분실물 등록 중 오류가 발생했습니다.'}), 500

    return jsonify(post.to_dict()), 201


@lost_found_bp.route('/<int:post_id>/status', methods=['POST'])
@jwt_required()
@require_role(UserRole.ADMIN, UserRole.STUDENT_COUNCIL)
def update_status(post_id):
    """Update lost-found status (`searching`/`found`)."""
    post = fetch_post_or_404(post_id)
    if not post:
        return jsonify({'error': '게시글을 찾을 수 없습니다.'}), 404

    data = request.get_json() or {}
    status = data.get('status')
    if status not in {item.value for item in LostFoundStatus}:
        return jsonify({'error': 'status는 searching 또는 found 이어야 합니다.'}), 422

    post.status = LostFoundStatus(status)
    try:
        db.session.commit()
        invalidate_cache_namespaces('lost_found')
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '상태 변경 중 오류가 발생했습니다.'}), 500

    return jsonify(post.to_dict())


@lost_found_bp.route('/uploads', methods=['POST'])
@lost_found_bp.route('/uploads/', methods=['POST'])
@jwt_required()
@require_role(UserRole.ADMIN, UserRole.STUDENT_COUNCIL)
def upload_image():
    """Validate and store image used by lost-found posts."""
    if 'file' not in request.files:
        return jsonify({'error': 'file 필드가 필요합니다.'}), 400

    file = request.files['file']
    result = validate_upload(file, current_app.config, require_image=True)
    if not result.get('ok'):
        return jsonify({'error': result.get('error', '파일 검증에 실패했습니다.')}), 422

    saved = save_upload_for_scope(file, current_app.config, 'lost_found')
    canonical_url = saved['url']
    preview_url = build_upload_preview_url(current_app.config, 'lost_found', saved['filename'])
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


@lost_found_bp.route('/uploads/<path:filename>', methods=['GET'], strict_slashes=False)
def serve_upload(filename):
    """Serve image with fallback access for unsaved temporary uploads."""
    upload_dir = resolve_scope_upload_dir(current_app.config, 'lost_found')
    ensure_dir(upload_dir)
    file_path = Path(upload_dir) / filename
    attachment_url = build_upload_url(current_app.config, 'lost_found', filename)
    attachment = LostFoundImage.query.filter_by(url=attachment_url).first()
    if not attachment:
        # Backward compatibility for rows that stored absolute URLs.
        attachment = LostFoundImage.query.filter(LostFoundImage.url.like(f'%{attachment_url}')).first()
    if not attachment:
        if not file_path.exists():
            return jsonify({'error': '첨부파일을 찾을 수 없습니다.'}), 404
        preview_token = request.args.get('preview_token', '')
        if not is_valid_upload_preview_token(
            current_app.config,
            'lost_found',
            filename,
            preview_token,
        ):
            return jsonify({'error': '첨부파일을 찾을 수 없습니다.'}), 404
        # Allow temporary preview only with a valid signed preview token.
        response = send_from_directory(upload_dir, filename, as_attachment=False, download_name=filename)
        response.headers['X-Content-Type-Options'] = 'nosniff'
        return response
    download_name = attachment.name if attachment else filename
    response = send_from_directory(upload_dir, filename, as_attachment=False, download_name=download_name)
    response.headers['X-Content-Type-Options'] = 'nosniff'
    return response


@lost_found_bp.route('/<int:post_id>/comments', methods=['GET'])
@cache_json_response('lost_found')
def list_comments(post_id):
    """List comments for one lost-found post."""
    post = fetch_post_or_404(post_id)
    if not post:
        return jsonify({'error': '게시글을 찾을 수 없습니다.'}), 404

    page, page_size = parse_pagination(request)
    order = request.args.get('order', 'asc')
    query = LostFoundComment.query.options(
        joinedload(LostFoundComment.user),
    ).filter(
        LostFoundComment.post_id == post.id,
        LostFoundComment.deleted_at.is_(None),
    )
    total = query.count()
    if order == 'desc':
        query = query.order_by(LostFoundComment.created_at.desc())
    else:
        query = query.order_by(LostFoundComment.created_at.asc())
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return jsonify(
        build_paginated_response(
            [item.to_dict() for item in items],
            total,
            page,
            page_size,
        )
    )


@lost_found_bp.route('/<int:post_id>/comments', methods=['POST'])
@jwt_required()
def create_comment(post_id):
    """Create comment and increment denormalized comments counter."""
    post = fetch_post_or_404(post_id)
    if not post:
        return jsonify({'error': '게시글을 찾을 수 없습니다.'}), 404

    data = request.get_json() or {}
    body = (data.get('body') or '').strip()
    if not 1 <= len(body) <= 1000:
        return jsonify({'error': '댓글은 1~1000자로 입력해주세요.'}), 422

    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404

    comment = LostFoundComment(
        post_id=post.id,
        user_id=user.id,
        body=body,
    )
    try:
        db.session.add(comment)
        post.comments_count = (post.comments_count or 0) + 1
        db.session.commit()
        invalidate_cache_namespaces('lost_found')
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '댓글 저장 중 오류가 발생했습니다.'}), 500

    return jsonify(comment.to_dict()), 201


@lost_found_bp.route('/<int:post_id>/comments/<int:comment_id>', methods=['DELETE'])
@jwt_required()
@require_role(UserRole.ADMIN)
def delete_comment(post_id, comment_id):
    """Soft-delete comment (admin only) and decrement comments count."""
    post = fetch_post_or_404(post_id)
    if not post:
        return jsonify({'error': '게시글을 찾을 수 없습니다.'}), 404

    comment = LostFoundComment.query.filter_by(id=comment_id, post_id=post.id).first()
    if not comment or comment.deleted_at:
        return jsonify({'error': '댓글을 찾을 수 없습니다.'}), 404

    try:
        comment.deleted_at = db.func.now()
        if (post.comments_count or 0) > 0:
            post.comments_count -= 1
        db.session.commit()
        invalidate_cache_namespaces('lost_found')
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '댓글 삭제 중 오류가 발생했습니다.'}), 500

    return jsonify({'message': '삭제되었습니다.'}), 200
