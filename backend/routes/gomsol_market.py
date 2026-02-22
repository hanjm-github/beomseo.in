"""
Gomsol market board routes.
"""
from datetime import datetime
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
    GomsolMarketPost,
    GomsolMarketImage,
    GomsolMarketCategory,
    GomsolMarketSaleStatus,
    GomsolMarketApprovalStatus,
)
from utils.pagination import parse_pagination, build_paginated_response
from utils.files import (
    save_upload_for_scope,
    resolve_scope_upload_dir,
    ensure_dir,
    build_upload_url,
    validate_upload,
    extract_upload_filename_for_scope,
)
from utils.security import require_role, get_current_user
from utils.cache import cache_json_response, invalidate_cache_namespaces

gomsol_market_bp = Blueprint('gomsol_market', __name__, url_prefix='/api/community/gomsol-market')


def optional_current_user():
    """Return authenticated user when token exists; otherwise None."""
    try:
        verify_jwt_in_request(optional=True)
        user_id = get_jwt_identity()
        return User.query.get(int(user_id)) if user_id else None
    except Exception:
        return None


def is_admin(user):
    """Role helper used for moderation visibility and approvals."""
    return user and user.role == UserRole.ADMIN


def fetch_post_or_404(post_id):
    """Fetch non-deleted market post with author/approver/images eager-loaded."""
    return GomsolMarketPost.query.options(
        joinedload(GomsolMarketPost.author),
        joinedload(GomsolMarketPost.approved_by),
        selectinload(GomsolMarketPost.images),
    ).filter(
        GomsolMarketPost.id == post_id,
        GomsolMarketPost.deleted_at.is_(None),
    ).first()


def parse_non_negative_int(value):
    """Parse non-negative integer values used by price validation."""
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value if value >= 0 else None
    if isinstance(value, float):
        if not value.is_integer():
            return None
        return int(value) if value >= 0 else None
    return None


def validate_create_payload(data):
    """
    Validate market payload and normalize contact/image fields.

    At least one contact channel is required to reduce dead-end listings.
    """
    errors = []
    max_attach_count = int(current_app.config.get('MAX_ATTACH_COUNT', 5))
    max_attach_size = int(current_app.config.get('MAX_ATTACH_SIZE', 10 * 1024 * 1024))
    upload_dir = Path(resolve_scope_upload_dir(current_app.config, 'gomsol_market'))

    title = (data.get('title') or '').strip()
    description = (data.get('description') or '').strip()
    price = parse_non_negative_int(data.get('price'))
    category = (data.get('category') or '').strip()
    status = (data.get('status') or '').strip() or GomsolMarketSaleStatus.SELLING.value
    images = data.get('images') or []
    contact = data.get('contact') or {}

    student_id = str(contact.get('studentId') or '').strip()
    open_chat_url = str(contact.get('openChatUrl') or '').strip()
    extra_contact = str(contact.get('extra') or '').strip()

    if not 2 <= len(title) <= 120:
        errors.append('제목은 2~120자로 입력해주세요.')

    if not 1 <= len(description) <= 2000:
        errors.append('설명은 1~2000자로 입력해주세요.')

    if price is None:
        errors.append('가격은 0 이상의 정수여야 합니다.')

    if category not in {item.value for item in GomsolMarketCategory}:
        errors.append('유효하지 않은 카테고리입니다.')

    if status not in {item.value for item in GomsolMarketSaleStatus}:
        errors.append('status는 selling 또는 sold 이어야 합니다.')

    if len(student_id) > 50:
        errors.append('학번은 50자 이하로 입력해주세요.')
    if len(open_chat_url) > 500:
        errors.append('오픈채팅 링크는 500자 이하로 입력해주세요.')
    if len(extra_contact) > 500:
        errors.append('기타 연락 방법은 500자 이하로 입력해주세요.')
    if not (student_id or open_chat_url or extra_contact):
        errors.append('연락 수단은 최소 1개 이상 입력해주세요.')

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

        filename = extract_upload_filename_for_scope(current_app.config, 'gomsol_market', image.get('url'))
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
                'url': build_upload_url(current_app.config, 'gomsol_market', filename),
                'mime': mime or None,
                'size': size,
                'kind': 'image',
                'display_order': index,
            }
        )

    return errors, {
        'title': title,
        'description': description,
        'price': price,
        'category': category,
        'status': status,
        'images': normalized_images,
        'contact_student_id': student_id,
        'contact_open_chat_url': open_chat_url,
        'contact_extra': extra_contact,
    }


@gomsol_market_bp.route('', methods=['GET'])
@gomsol_market_bp.route('/', methods=['GET'])
@cache_json_response('gomsol_market')
def list_posts():
    """List market posts with role-aware approval visibility."""
    status = request.args.get('status')
    category = request.args.get('category')
    approval = request.args.get('approval')
    q_text = (request.args.get('q') or request.args.get('query') or '').strip()
    sort = request.args.get('sort', 'recent')
    view = request.args.get('view')
    page, page_size = parse_pagination(request, default_page_size=12, max_page_size=50)

    current_user = optional_current_user()
    admin_mode = is_admin(current_user)

    query = GomsolMarketPost.query.options(
        joinedload(GomsolMarketPost.author),
        joinedload(GomsolMarketPost.approved_by),
        selectinload(GomsolMarketPost.images),
    ).filter(GomsolMarketPost.deleted_at.is_(None))

    if status in {item.value for item in GomsolMarketSaleStatus}:
        query = query.filter(GomsolMarketPost.status == GomsolMarketSaleStatus(status))

    if category in {item.value for item in GomsolMarketCategory}:
        query = query.filter(GomsolMarketPost.category == GomsolMarketCategory(category))

    if admin_mode:
        if approval in {item.value for item in GomsolMarketApprovalStatus}:
            query = query.filter(GomsolMarketPost.approval_status == GomsolMarketApprovalStatus(approval))
    else:
        if current_user:
            query = query.filter(
                or_(
                    GomsolMarketPost.approval_status == GomsolMarketApprovalStatus.APPROVED,
                    GomsolMarketPost.author_id == current_user.id,
                )
            )
        else:
            query = query.filter(GomsolMarketPost.approval_status == GomsolMarketApprovalStatus.APPROVED)

    if q_text:
        pattern = f'%{q_text}%'
        query = query.filter(
            or_(
                GomsolMarketPost.title.ilike(pattern),
                GomsolMarketPost.description.ilike(pattern),
                GomsolMarketPost.contact_extra.ilike(pattern),
            )
        )

    if sort == 'price-asc':
        query = query.order_by(GomsolMarketPost.price.asc(), GomsolMarketPost.created_at.desc())
    elif sort == 'price-desc':
        query = query.order_by(GomsolMarketPost.price.desc(), GomsolMarketPost.created_at.desc())
    else:
        query = query.order_by(GomsolMarketPost.created_at.desc())

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


@gomsol_market_bp.route('/<int:post_id>', methods=['GET'])
@jwt_required()
def get_post(post_id):
    """Return post detail while protecting pending listings from public access."""
    post = fetch_post_or_404(post_id)
    if not post:
        return jsonify({'error': '게시글을 찾을 수 없습니다.'}), 404

    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'User not found'}), 404

    can_read_pending = is_admin(current_user) or (current_user and current_user.id == post.author_id)
    if post.approval_status != GomsolMarketApprovalStatus.APPROVED and not can_read_pending:
        return jsonify({'error': '열람 권한이 없습니다.'}), 403

    try:
        post.views = (post.views or 0) + 1
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()

    return jsonify(post.to_dict())


@gomsol_market_bp.route('', methods=['POST'])
@gomsol_market_bp.route('/', methods=['POST'])
@jwt_required()
def create_post():
    """Create market post in pending approval state."""
    data = request.get_json() or {}
    errors, payload = validate_create_payload(data)
    if errors:
        return jsonify({'errors': errors}), 422

    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404

    post = GomsolMarketPost(
        title=payload['title'],
        description=payload['description'],
        price=payload['price'],
        category=GomsolMarketCategory(payload['category']),
        status=GomsolMarketSaleStatus(payload['status']),
        approval_status=GomsolMarketApprovalStatus.PENDING,
        contact_student_id=payload['contact_student_id'],
        contact_open_chat_url=payload['contact_open_chat_url'],
        contact_extra=payload['contact_extra'],
        author_id=user.id,
        author_role=user.role.value,
    )

    for image in payload['images']:
        post.images.append(
            GomsolMarketImage(
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
        invalidate_cache_namespaces('gomsol_market')
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '게시글 저장 중 오류가 발생했습니다.'}), 500

    return jsonify(post.to_dict()), 201


@gomsol_market_bp.route('/<int:post_id>/approve', methods=['POST'])
@jwt_required()
@require_role(UserRole.ADMIN)
def approve_post(post_id):
    """Approve market post and persist moderation metadata."""
    post = fetch_post_or_404(post_id)
    if not post:
        return jsonify({'error': '게시글을 찾을 수 없습니다.'}), 404

    post.approval_status = GomsolMarketApprovalStatus.APPROVED
    post.approved_by_id = get_current_user().id
    post.approved_at = datetime.utcnow()
    try:
        db.session.commit()
        invalidate_cache_namespaces('gomsol_market')
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '승인 처리 중 오류가 발생했습니다.'}), 500
    return jsonify(post.to_dict())


@gomsol_market_bp.route('/<int:post_id>/unapprove', methods=['POST'])
@jwt_required()
@require_role(UserRole.ADMIN)
def unapprove_post(post_id):
    """Revert market post back to pending approval state."""
    post = fetch_post_or_404(post_id)
    if not post:
        return jsonify({'error': '게시글을 찾을 수 없습니다.'}), 404

    post.approval_status = GomsolMarketApprovalStatus.PENDING
    post.approved_by_id = None
    post.approved_at = None
    try:
        db.session.commit()
        invalidate_cache_namespaces('gomsol_market')
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '승인 해제 중 오류가 발생했습니다.'}), 500
    return jsonify(post.to_dict())


@gomsol_market_bp.route('/<int:post_id>/status', methods=['POST'])
@jwt_required()
def update_status(post_id):
    """Update sale status (`selling`/`sold`) for author or admin."""
    post = fetch_post_or_404(post_id)
    if not post:
        return jsonify({'error': '게시글을 찾을 수 없습니다.'}), 404

    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404

    if not (is_admin(user) or post.author_id == user.id):
        return jsonify({'error': '상태 변경 권한이 없습니다.'}), 403

    data = request.get_json() or {}
    status = data.get('status')
    if status not in {item.value for item in GomsolMarketSaleStatus}:
        return jsonify({'error': 'status는 selling 또는 sold 이어야 합니다.'}), 422

    post.status = GomsolMarketSaleStatus(status)
    try:
        db.session.commit()
        invalidate_cache_namespaces('gomsol_market')
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '상태 변경 중 오류가 발생했습니다.'}), 500

    return jsonify(post.to_dict())


@gomsol_market_bp.route('/uploads', methods=['POST'])
@gomsol_market_bp.route('/uploads/', methods=['POST'])
@jwt_required()
def upload_image():
    """Validate and store market image upload."""
    if 'file' not in request.files:
        return jsonify({'error': 'file 필드가 필요합니다.'}), 400

    file = request.files['file']
    result = validate_upload(file, current_app.config, require_image=True)
    if not result.get('ok'):
        return jsonify({'error': result.get('error', '파일 검증에 실패했습니다.')}), 422

    saved = save_upload_for_scope(file, current_app.config, 'gomsol_market')
    return jsonify(
        {
            'id': saved['filename'],
            'name': result['name'],
            'size': result['size'],
            'url': saved['url'],
            'mime': result['mime'],
            'kind': result['kind'],
        }
    ), 201


@gomsol_market_bp.route('/uploads/<path:filename>', methods=['GET'], strict_slashes=False)
def serve_upload(filename):
    """Serve market image with pending-post access policy and temp fallback."""
    upload_dir = resolve_scope_upload_dir(current_app.config, 'gomsol_market')
    ensure_dir(upload_dir)
    file_path = Path(upload_dir) / filename
    image_url = build_upload_url(current_app.config, 'gomsol_market', filename)
    image = GomsolMarketImage.query.filter_by(url=image_url).first()
    if not image:
        # Backward compatibility for rows that stored absolute URLs.
        image = GomsolMarketImage.query.filter(GomsolMarketImage.url.like(f'%{image_url}')).first()
    if not image or not image.post:
        if not file_path.exists():
            return jsonify({'error': '첨부파일을 찾을 수 없습니다.'}), 404
        # Allow temporary preview for newly uploaded images before post save.
        response = send_from_directory(upload_dir, filename, as_attachment=False, download_name=filename)
        response.headers['X-Content-Type-Options'] = 'nosniff'
        return response

    current_user = optional_current_user()
    post = image.post
    can_read_pending = is_admin(current_user) or (current_user and current_user.id == post.author_id)
    if post.approval_status != GomsolMarketApprovalStatus.APPROVED and not can_read_pending:
        return jsonify({'error': '열람 권한이 없습니다.'}), 403

    download_name = image.name if image else filename
    response = send_from_directory(upload_dir, filename, as_attachment=False, download_name=download_name)
    response.headers['X-Content-Type-Options'] = 'nosniff'
    return response
