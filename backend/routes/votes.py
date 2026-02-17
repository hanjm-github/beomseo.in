"""
Realtime vote board routes.
"""
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from sqlalchemy import or_

from models import (
    db,
    User,
    UserRole,
    SurveyCredit,
    Vote,
    VoteOption,
    VoteResponse,
)
from utils.pagination import parse_pagination, build_paginated_response
from utils.security import require_role, get_current_user

votes_bp = Blueprint('votes', __name__, url_prefix='/api/community/votes')


def parse_bool(value, default=False):
    if value is None:
        return default
    return str(value).lower() in {'1', 'true', 'yes', 'on'}


def optional_current_user():
    try:
        verify_jwt_in_request(optional=True)
        user_id = get_jwt_identity()
        return User.query.get(int(user_id)) if user_id else None
    except Exception:
        return None


def parse_iso_datetime(value):
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


def ensure_credit(user_id: int):
    base = current_app.config.get('SURVEY_BASE_QUOTA', 0)
    credit = SurveyCredit.query.get(user_id)
    if credit:
        return credit

    credit = SurveyCredit(user_id=user_id, base=base, earned=0, used=0)
    db.session.add(credit)
    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
    return SurveyCredit.query.get(user_id) or credit


def validate_create_payload(data):
    errors = []
    title = (data.get('title') or '').strip()
    description = (data.get('description') or '').strip()
    closes_at_raw = data.get('closesAt') or data.get('closes_at')
    closes_at = parse_iso_datetime(closes_at_raw)
    options_raw = data.get('options') or []

    min_title = current_app.config.get('VOTE_MIN_TITLE_LENGTH', 2)
    max_title = current_app.config.get('VOTE_MAX_TITLE_LENGTH', 120)
    max_description = current_app.config.get('VOTE_MAX_DESCRIPTION_LENGTH', 1000)
    min_options = current_app.config.get('VOTE_MIN_OPTIONS', 2)
    max_options = current_app.config.get('VOTE_MAX_OPTIONS', 8)
    max_option_text = current_app.config.get('VOTE_MAX_OPTION_LENGTH', 80)

    if not min_title <= len(title) <= max_title:
        errors.append(f'제목은 {min_title}~{max_title}자로 입력해주세요.')

    if len(description) > max_description:
        errors.append(f'설명은 {max_description}자 이하로 입력해주세요.')

    if closes_at_raw not in (None, '') and closes_at is None:
        errors.append('마감일시 형식이 올바르지 않습니다.')

    if closes_at and closes_at <= datetime.utcnow():
        errors.append('마감일시는 현재 시각보다 이후여야 합니다.')

    if not isinstance(options_raw, list):
        errors.append('options는 배열이어야 합니다.')
        options_raw = []

    if not min_options <= len(options_raw) <= max_options:
        errors.append(f'선택지는 최소 {min_options}개, 최대 {max_options}개까지 가능합니다.')

    normalized_options = []
    option_keys_seen = set()
    option_text_seen = set()

    for index, raw in enumerate(options_raw):
        if not isinstance(raw, dict):
            errors.append('선택지 형식이 올바르지 않습니다.')
            continue

        option_key = str(raw.get('id') or f'opt-{index + 1}').strip()
        text = str(raw.get('text') or '').strip()

        if not option_key:
            errors.append('선택지 id는 비어 있을 수 없습니다.')
            continue

        if not text:
            errors.append('선택지 내용은 비어 있을 수 없습니다.')
            continue

        if len(text) > max_option_text:
            errors.append(f'선택지 내용은 {max_option_text}자 이하로 입력해주세요.')

        key_lower = option_key.lower()
        if key_lower in option_keys_seen:
            errors.append('선택지 id는 중복될 수 없습니다.')
        option_keys_seen.add(key_lower)

        text_lower = text.lower()
        if text_lower in option_text_seen:
            errors.append('동일한 선택지를 중복 입력할 수 없습니다.')
        option_text_seen.add(text_lower)

        normalized_options.append(
            {
                'id': option_key,
                'text': text,
                'display_order': index,
            }
        )

    return errors, {
        'title': title,
        'description': description,
        'closes_at': closes_at,
        'options': normalized_options,
    }


def fetch_vote(vote_id):
    return Vote.query.filter(Vote.id == vote_id, Vote.deleted_at.is_(None)).first()


def vote_option_map(vote_ids, user_id):
    if not vote_ids or not user_id:
        return {}

    rows = (
        db.session.query(VoteResponse.vote_id, VoteOption.option_key)
        .join(VoteOption, VoteResponse.option_id == VoteOption.id)
        .filter(
            VoteResponse.respondent_id == user_id,
            VoteResponse.vote_id.in_(vote_ids),
        )
        .all()
    )
    return {row[0]: row[1] for row in rows}


@votes_bp.route('', methods=['GET'])
@votes_bp.route('/', methods=['GET'])
def list_votes():
    sort = request.args.get('sort', 'recent')
    q_text = (request.args.get('q') or '').strip()
    include_closed = parse_bool(
        request.args.get('includeClosed', request.args.get('closed')),
        default=False,
    )
    page, page_size = parse_pagination(request, default_page_size=12, max_page_size=50)

    now = datetime.utcnow()
    query = Vote.query.filter(Vote.deleted_at.is_(None))

    if q_text:
        pattern = f'%{q_text}%'
        query = query.filter(
            or_(
                Vote.title.ilike(pattern),
                Vote.description.ilike(pattern),
                Vote.options.any(VoteOption.text.ilike(pattern)),
            )
        )

    if not include_closed:
        query = query.filter(or_(Vote.closes_at.is_(None), Vote.closes_at > now))

    if sort == 'participation':
        query = query.order_by(Vote.total_votes.desc(), Vote.created_at.desc())
    elif sort == 'deadline':
        query = query.order_by(Vote.closes_at.is_(None), Vote.closes_at.asc(), Vote.created_at.desc())
    else:
        query = query.order_by(Vote.created_at.desc())

    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()

    current_user = optional_current_user()
    my_votes = vote_option_map([item.id for item in items], current_user.id if current_user else None)

    payload_items = [item.to_dict(my_vote_option_id=my_votes.get(item.id), now=now) for item in items]
    return jsonify(build_paginated_response(payload_items, total, page, page_size))


@votes_bp.route('/<int:vote_id>', methods=['GET'])
def get_vote(vote_id):
    vote = fetch_vote(vote_id)
    if not vote:
        return jsonify({'error': '투표를 찾을 수 없습니다.'}), 404

    current_user = optional_current_user()
    selected_option = None
    if current_user:
        response = VoteResponse.query.filter_by(vote_id=vote.id, respondent_id=current_user.id).first()
        selected_option = response.option.option_key if response and response.option else None

    return jsonify(vote.to_dict(my_vote_option_id=selected_option, now=datetime.utcnow()))


@votes_bp.route('', methods=['POST'])
@votes_bp.route('/', methods=['POST'])
@jwt_required()
@require_role(UserRole.ADMIN, UserRole.STUDENT_COUNCIL)
def create_vote():
    data = request.get_json() or {}
    errors, payload = validate_create_payload(data)
    if errors:
        return jsonify({'errors': errors}), 422

    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404

    vote = Vote(
        title=payload['title'],
        description=payload['description'],
        closes_at=payload['closes_at'],
        author_id=user.id,
        author_role=user.role.value,
    )

    for option in payload['options']:
        vote.options.append(
            VoteOption(
                option_key=option['id'],
                text=option['text'],
                display_order=option['display_order'],
            )
        )

    try:
        db.session.add(vote)
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '투표 생성 중 오류가 발생했습니다.'}), 500

    return jsonify(vote.to_dict(my_vote_option_id=None, now=datetime.utcnow())), 201


@votes_bp.route('/<int:vote_id>/vote', methods=['POST'])
@jwt_required()
def submit_vote(vote_id):
    vote = fetch_vote(vote_id)
    if not vote:
        return jsonify({'error': '투표를 찾을 수 없습니다.'}), 404

    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404

    if vote.status(now=datetime.utcnow()) != 'open':
        return jsonify({'error': '이미 마감된 투표입니다.'}), 422

    existing = VoteResponse.query.filter_by(vote_id=vote.id, respondent_id=user.id).first()
    if existing:
        return jsonify({'error': '이미 투표에 참여했습니다.'}), 409

    data = request.get_json() or {}
    option_id = str(data.get('optionId') or '').strip()
    if not option_id:
        return jsonify({'error': 'optionId는 필수입니다.'}), 422

    option = VoteOption.query.filter_by(vote_id=vote.id, option_key=option_id).first()
    if not option:
        return jsonify({'error': '유효하지 않은 선택지입니다.'}), 422

    reward = max(0, int(current_app.config.get('VOTE_REWARD_CREDITS', 1)))
    credit = ensure_credit(user.id)

    try:
        response = VoteResponse(
            vote_id=vote.id,
            option_id=option.id,
            respondent_id=user.id,
            credits_earned=reward,
        )
        db.session.add(response)
        option.votes_count = (option.votes_count or 0) + 1
        vote.total_votes = (vote.total_votes or 0) + 1
        if reward > 0 and credit:
            credit.earn(reward)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({'error': '이미 투표에 참여했습니다.'}), 409
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '투표 처리 중 오류가 발생했습니다.'}), 500

    refreshed_credit = SurveyCredit.query.get(user.id) if credit else None
    return jsonify(
        {
            'voteId': response.id,
            'selectedOptionId': option.option_key,
            'creditsEarned': reward,
            'creditsAvailable': refreshed_credit.available if refreshed_credit else 0,
            'poll': vote.to_dict(my_vote_option_id=option.option_key, now=datetime.utcnow()),
        }
    ), 201
