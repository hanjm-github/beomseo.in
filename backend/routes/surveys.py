"""
Survey exchange board routes.
"""
from datetime import datetime, date
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import (
    jwt_required,
    get_jwt_identity,
    verify_jwt_in_request,
)
from sqlalchemy import or_
from sqlalchemy.exc import SQLAlchemyError, IntegrityError

from models import (
    db,
    User,
    UserRole,
    Survey,
    SurveyStatus,
    SurveyResponse,
    SurveyCredit,
)
from utils.pagination import parse_pagination
from utils.security import require_role, get_current_user

surveys_bp = Blueprint('surveys', __name__, url_prefix='/api/surveys')


# Helpers
def optional_current_user():
    try:
        verify_jwt_in_request(optional=True)
        uid = get_jwt_identity()
        return User.query.get(int(uid)) if uid else None
    except Exception:
        return None


def parse_date(value):
    if not value:
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except Exception:
        return None


def ensure_credit(user_id: int):
    """Lazy-create survey credit row."""
    base = current_app.config.get('SURVEY_BASE_QUOTA', 10)
    credit = SurveyCredit.query.get(user_id)
    if not credit:
        credit = SurveyCredit(user_id=user_id, base=base, earned=0, used=0)
        db.session.add(credit)
        try:
            db.session.commit()
        except SQLAlchemyError:
            db.session.rollback()
            # return without raising; caller may handle missing credit by re-query
    return SurveyCredit.query.get(user_id) or credit


def normalize_answers(raw):
    """
    Form builder 응답이 dict가 아닌 list로 넘어오는 경우가 있어 안전 변환.
    우선순위:
    - dict이면 그대로 반환
    - list이면 각 item이 dict일 때
        * name/value 키가 있으면 {name: value} 형태로 매핑
        * 아니면 병합
    - 그 외 타입은 빈 dict
    """
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, list):
        merged = {}
        for item in raw:
            if isinstance(item, dict):
                if 'name' in item and 'value' in item:
                    merged[item['name']] = item.get('value')
                elif 'name' in item and 'answer' in item:
                    merged[item['name']] = item.get('answer')
                else:
                    merged.update(item)
        return merged
    return {}


OPTION_KEY_PREFIXES = (
    'checkboxes_option_',
    'radiobuttons_option_',
    'dropdown_option_',
    'select_option_',
    'selectboxes_option_',
)


def option_key_candidates(raw_value):
    """Build normalized candidate keys for option matching."""
    if raw_value is None:
        return []

    token = str(raw_value).strip()
    if not token:
        return []

    candidates = {token, token.lower(), token.upper()}
    token_lower = token.lower()

    for prefix in OPTION_KEY_PREFIXES:
        if token_lower.startswith(prefix):
            suffix = token[len(prefix):]
            if suffix:
                candidates.update({suffix, suffix.lower(), suffix.upper()})
        else:
            candidates.update(
                {
                    f'{prefix}{token}',
                    f'{prefix}{token.lower()}',
                    f'{prefix}{token.upper()}',
                }
            )

    return [candidate for candidate in candidates if candidate]


def build_option_maps(form_items):
    """
    Build mapping per question id: value/key -> human-readable text.
    """
    option_maps = {}
    for item in form_items or []:
        qid = item.get('field_name') or item.get('id')
        if not qid:
            continue
        options = item.get('options') or []
        mapping = {}
        for opt in options:
            id_sources = [
                opt.get('value'),
                opt.get('key'),
                opt.get('id'),
                opt.get('option_id'),
                opt.get('name'),
            ]
            fallback_id = next((source for source in id_sources if source not in (None, '')), None)
            text = opt.get('text') or opt.get('label') or (str(fallback_id) if fallback_id is not None else '')

            for source in id_sources:
                for candidate in option_key_candidates(source):
                    mapping[candidate] = text
        if mapping:
            option_maps[qid] = mapping
    return option_maps


def map_value(option_map, value):
    if option_map is None:
        return value

    for candidate in option_key_candidates(value):
        if candidate in option_map:
            return option_map[candidate]

    return value


def validate_payload(data: dict):
    errors = []
    title = (data.get('title') or '').strip()
    description = (data.get('description') or '').strip()
    form_json = data.get('formJson') or data.get('form_json') or []
    expires_at = parse_date(data.get('expiresAt') or data.get('expires_at'))

    if not 2 <= len(title) <= 200:
        errors.append('제목은 2~200자로 입력해주세요.')
    if description and len(description) > 1000:
        errors.append('설명은 1000자 이하로 입력해주세요.')
    if not isinstance(form_json, list) or len(form_json) == 0:
        errors.append('formJson은 최소 1개 이상의 항목이 필요합니다.')

    return errors, {
        'title': title,
        'description': description,
        'form_json': form_json,
        'expires_at': expires_at,
    }


def fetch_survey_or_404(survey_id):
    try:
        sid = int(survey_id)
    except (TypeError, ValueError):
        return None
    survey = Survey.query.filter(Survey.id == sid, Survey.deleted_at.is_(None)).first()
    return survey


def build_quota_map(surveys):
    owner_ids = {s.owner_id for s in surveys}
    if not owner_ids:
        return {}
    credits = SurveyCredit.query.filter(SurveyCredit.user_id.in_(owner_ids)).all()
    credit_map = {c.user_id: c for c in credits}
    base = current_app.config.get('SURVEY_BASE_QUOTA', 10)
    for uid in owner_ids:
        if uid not in credit_map:
            c = SurveyCredit(user_id=uid, base=base, earned=0, used=0)
            db.session.add(c)
            credit_map[uid] = c
    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
    return credit_map


# Routes
@surveys_bp.route('', methods=['GET'])
@surveys_bp.route('/', methods=['GET'])
def list_surveys():
    status = request.args.get('status')
    q_text = request.args.get('q') or request.args.get('query')
    sort = request.args.get('sort', 'recent')
    mine = request.args.get('mine') == '1'
    hide_answered = request.args.get('hide') == '1'
    page, page_size = parse_pagination(request, default_page_size=12, max_page_size=50)

    current_user = optional_current_user()
    is_admin = current_user and current_user.role == UserRole.ADMIN

    # mine/hide 옵션은 인증이 필요
    if (mine or hide_answered) and not current_user:
        return jsonify({'error': '로그인이 필요합니다.'}), 401

    query = Survey.query.filter(Survey.deleted_at.is_(None))

    if not is_admin:
        query = query.filter(Survey.status == SurveyStatus.APPROVED)
    else:
        if status == SurveyStatus.PENDING.value:
            query = query.filter(Survey.status == SurveyStatus.PENDING)
        elif status == SurveyStatus.APPROVED.value:
            query = query.filter(Survey.status == SurveyStatus.APPROVED)
        # status=all -> no extra filter

    if mine and current_user:
        query = query.filter(Survey.owner_id == current_user.id)

    if q_text:
        pattern = f"%{q_text}%"
        query = query.filter(
            or_(Survey.title.ilike(pattern), Survey.description.ilike(pattern))
        )

    # answered map for hide/isAnswered flag
    answered_ids = set()
    if current_user:
        resp_sub = SurveyResponse.query.with_entities(SurveyResponse.survey_id).filter(
            SurveyResponse.respondent_id == current_user.id
        )
        answered_ids = {row[0] for row in resp_sub.all()}
        if hide_answered and answered_ids:
            query = query.filter(~Survey.id.in_(answered_ids))

    surveys = query.order_by(Survey.created_at.desc()).all()
    credit_map = build_quota_map(surveys)

    def remaining_quota(s: Survey):
        c = credit_map.get(s.owner_id)
        available = c.available if c else current_app.config.get('SURVEY_BASE_QUOTA', 10)
        return max(0, available)

    if sort == 'quota-asc':
        surveys.sort(
            key=lambda s: (
                remaining_quota(s) - (s.responses_received or 0),
                s.created_at or datetime.min,
            )
        )
    elif sort == 'responses-desc':
        surveys.sort(key=lambda s: (s.responses_received or 0, s.created_at or datetime.min), reverse=True)
    else:  # recent
        surveys.sort(key=lambda s: s.created_at or datetime.min, reverse=True)

    total = len(surveys)
    start = (page - 1) * page_size
    end = start + page_size
    paged = surveys[start:end]

    items = []
    for s in paged:
        credit = credit_map.get(s.owner_id)
        available = credit.available if credit else current_app.config.get('SURVEY_BASE_QUOTA', 10)
        total_quota = max(0, available) + (s.responses_received or 0)
        items.append(
            s.to_dict(
                include_form=False,
                include_body=False,
                is_answered=s.id in answered_ids,
                quota_available=total_quota,
            )
        )

    return jsonify({
        'items': items,
        'total': total,
        'page': page,
        'page_size': page_size,
    })


@surveys_bp.route('/<survey_id>', methods=['GET'])
def get_survey(survey_id):
    survey = fetch_survey_or_404(survey_id)
    if not survey:
        return jsonify({'error': '설문을 찾을 수 없습니다.'}), 404

    current_user = optional_current_user()
    is_admin = current_user and current_user.role == UserRole.ADMIN
    is_owner = current_user and current_user.id == survey.owner_id

    if survey.status != SurveyStatus.APPROVED and not (is_admin or is_owner):
        return jsonify({'error': '열람 권한이 없습니다.'}), 403

    answered = False
    if current_user:
        answered = SurveyResponse.query.filter_by(
            survey_id=survey.id, respondent_id=current_user.id
        ).first() is not None

    credit = ensure_credit(survey.owner_id)
    available = credit.available if credit else current_app.config.get('SURVEY_BASE_QUOTA', 10)
    total_quota = max(0, available) + (survey.responses_received or 0)

    return jsonify(
        survey.to_dict(
            include_form=True,
            include_body=True,
            is_answered=answered,
            quota_available=total_quota,
        )
    )


@surveys_bp.route('', methods=['POST'])
@surveys_bp.route('/', methods=['POST'])
@jwt_required()
def create_survey():
    data = request.get_json() or {}
    errors, payload = validate_payload(data)
    if errors:
        return jsonify({'errors': errors}), 422

    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404

    survey = Survey(
        title=payload['title'],
        description=payload['description'],
        summary=payload['description'][:300] if payload['description'] else None,
        form_json=payload['form_json'],
        status=SurveyStatus.PENDING,
        responses_received=0,
        expires_at=payload['expires_at'],
        owner_id=user.id,
        owner_role=user.role.value,
    )
    try:
        db.session.add(survey)
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '등록 중 오류가 발생했습니다.'}), 500

    credit = ensure_credit(user.id)
    available = credit.available if credit else current_app.config.get('SURVEY_BASE_QUOTA', 10)
    return jsonify(survey.to_dict(quota_available=available)), 201


def can_edit(survey: Survey, user: User):
    if not user:
        return False
    if user.role == UserRole.ADMIN:
        return True
    return survey.owner_id == user.id and survey.status == SurveyStatus.PENDING


@surveys_bp.route('/<survey_id>', methods=['PATCH'])
@jwt_required()
def update_survey(survey_id):
    # Editing surveys is no longer allowed.
    return jsonify({'error': '설문 수정 기능이 비활성화되었습니다.'}), 405


@surveys_bp.route('/<survey_id>/approve', methods=['POST'])
@jwt_required()
@require_role(UserRole.ADMIN)
def approve_survey(survey_id):
    survey = fetch_survey_or_404(survey_id)
    if not survey:
        return jsonify({'error': '설문을 찾을 수 없습니다.'}), 404

    survey.status = SurveyStatus.APPROVED
    survey.approved_by_id = get_current_user().id
    survey.approved_at = datetime.utcnow()

    # 승인 시 최초 1회 응답권 30 추가
    grant_amount = 30
    owner_credit = ensure_credit(survey.owner_id)
    if owner_credit and not survey.credit_granted:
        owner_credit.earn(grant_amount)
        survey.credit_granted = True

    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '승인 처리 중 오류가 발생했습니다.'}), 500

    credit = ensure_credit(survey.owner_id)
    available = credit.available if credit else current_app.config.get('SURVEY_BASE_QUOTA', 10)
    total_quota = max(0, available) + (survey.responses_received or 0)
    return jsonify(survey.to_dict(quota_available=total_quota))


@surveys_bp.route('/<survey_id>/unapprove', methods=['POST'])
@jwt_required()
@require_role(UserRole.ADMIN)
def unapprove_survey(survey_id):
    survey = fetch_survey_or_404(survey_id)
    if not survey:
        return jsonify({'error': '설문을 찾을 수 없습니다.'}), 404

    survey.status = SurveyStatus.PENDING
    survey.approved_by_id = None
    survey.approved_at = None

    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '승인 해제 중 오류가 발생했습니다.'}), 500

    credit = ensure_credit(survey.owner_id)
    available = credit.available if credit else current_app.config.get('SURVEY_BASE_QUOTA', 10)
    total_quota = max(0, available) + (survey.responses_received or 0)
    return jsonify(survey.to_dict(quota_available=total_quota))


def survey_is_open(survey: Survey, credit_available: int):
    if survey.status != SurveyStatus.APPROVED:
        return False
    if survey.expires_at and survey.expires_at <= date.today():
        return False
    if credit_available <= 0:
        return False
    return True


@surveys_bp.route('/<survey_id>/responses', methods=['POST'])
@jwt_required()
def submit_response(survey_id):
    survey = fetch_survey_or_404(survey_id)
    if not survey:
        return jsonify({'error': '설문을 찾을 수 없습니다.'}), 404

    respondent = get_current_user()
    if not respondent:
        return jsonify({'error': 'User not found'}), 404

    owner_credit = ensure_credit(survey.owner_id)
    owner_available = owner_credit.available if owner_credit else 0

    if not survey_is_open(survey, owner_available):
        return jsonify({'error': '설문이 마감되었습니다.'}), 422

    data = request.get_json() or {}
    answers = data.get('answers')
    if answers is None:
        return jsonify({'error': 'answers 필드가 필요합니다.'}), 422
    normalized_answers = normalize_answers(answers)
    if not normalized_answers and isinstance(answers, dict):
        normalized_answers = answers

    # 중복 응답 확인 (이미 응답한 경우 갱신 허용, 크레딧/카운트는 추가로 올리지 않음)
    existing = SurveyResponse.query.filter_by(
        survey_id=survey.id, respondent_id=respondent.id
    ).first()
    if existing:
        return jsonify({'error': '이미 응답한 설문입니다.'}), 409

    credits_earned = 0
    respondent_credit = None
    if respondent.id != survey.owner_id:
        respondent_credit = ensure_credit(respondent.id)

    if owner_credit.available <= 0:
        return jsonify({'error': '응답 가능 수가 모두 소진되었습니다.'}), 429

    try:
        response = SurveyResponse(
            survey_id=survey.id,
            respondent_id=respondent.id,
            answers=normalized_answers,
            submitted_at=datetime.utcnow(),
        )
        db.session.add(response)
        survey.responses_received = (survey.responses_received or 0) + 1
        owner_credit.consume(1)
        if respondent_credit and respondent.id != survey.owner_id:
            earn_amount = 5
            respondent_credit.earn(earn_amount)
            credits_earned = earn_amount
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({'error': '이미 응답한 설문입니다.'}), 409
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '응답 저장 중 오류가 발생했습니다.'}), 500

    owner_available_after = owner_credit.available if owner_credit else 0
    total_quota_after = max(0, owner_available_after) + (survey.responses_received or 0)
    return jsonify({
        'responseId': response.id,
        'creditsEarned': credits_earned,
        'creditsAvailable': owner_available_after,
        'responseQuota': total_quota_after,
        'responsesReceived': survey.responses_received,
    }), 201


@surveys_bp.route('/<survey_id>/summary', methods=['GET'])
@jwt_required()
def survey_summary(survey_id):
    survey = fetch_survey_or_404(survey_id)
    if not survey:
        return jsonify({'error': '설문을 찾을 수 없습니다.'}), 404

    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    if user.role != UserRole.ADMIN and user.id != survey.owner_id:
        return jsonify({'error': '결과 조회 권한이 없습니다.'}), 403

    responses = SurveyResponse.query.filter_by(survey_id=survey.id).all()
    total = len(responses)
    questions_summary = []

    form_items = survey.form_json or []
    option_maps = build_option_maps(form_items)
    for item in form_items:
        qid = item.get('field_name') or item.get('id')
        if not qid:
            continue
        label = item.get('label') or item.get('text') or qid
        element = item.get('element')
        opt_map = option_maps.get(qid)
        if element in {'RadioButtons', 'Dropdown', 'Select', 'SelectBoxes'}:
            counts = {}
            for r in responses:
                ans_map = normalize_answers(r.answers)
                ans = ans_map.get(qid)
                if ans is None:
                    continue
                key = map_value(opt_map, ans)
                key = str(key)
                counts[key] = counts.get(key, 0) + 1
            questions_summary.append({'id': qid, 'text': label, 'type': 'choice', 'counts': counts})
        elif element == 'Checkboxes':
            counts = {}
            for r in responses:
                ans_map = normalize_answers(r.answers)
                ans = ans_map.get(qid)
                if ans is None:
                    continue
                if isinstance(ans, list):
                    values = [map_value(opt_map, v) for v in ans]
                elif isinstance(ans, dict):
                    values = [map_value(opt_map, k) for k, v in ans.items() if v]
                else:
                    values = [map_value(opt_map, ans)]
                for v in values:
                    key = str(v)
                    counts[key] = counts.get(key, 0) + 1
            questions_summary.append({'id': qid, 'text': label, 'type': 'choice', 'counts': counts})
        else:
            samples = []
            for r in responses:
                ans_map = normalize_answers(r.answers)
                ans = ans_map.get(qid)
                if ans is None:
                    continue
                if isinstance(ans, (list, dict)):
                    samples.append(str(ans))
                else:
                    samples.append(str(ans))
            questions_summary.append({'id': qid, 'text': label, 'type': 'text', 'samples': samples[:5]})

    return jsonify({'questions': questions_summary, 'total': total})


@surveys_bp.route('/<survey_id>/responses', methods=['GET'])
@jwt_required()
def survey_raw_responses(survey_id):
    survey = fetch_survey_or_404(survey_id)
    if not survey:
        return jsonify({'error': '설문을 찾을 수 없습니다.'}), 404

    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    if user.role != UserRole.ADMIN and user.id != survey.owner_id:
        return jsonify({'error': '결과 조회 권한이 없습니다.'}), 403

    responses = SurveyResponse.query.filter_by(survey_id=survey.id).order_by(SurveyResponse.submitted_at.desc()).all()
    rows = []
    option_maps = build_option_maps(survey.form_json or [])
    for r in responses:
        row = r.to_raw_dict()
        ans_map = normalize_answers(row.get('answers'))
        pretty = {}
        for qid, val in ans_map.items():
            opt_map = option_maps.get(qid)
            if isinstance(val, list):
                pretty[qid] = [map_value(opt_map, v) for v in val]
            elif isinstance(val, dict):
                pretty[qid] = {map_value(opt_map, k): v for k, v in val.items()}
            else:
                pretty[qid] = map_value(opt_map, val)
        row['answers'] = pretty
        rows.append(row)
    return jsonify({'total': len(rows), 'rows': rows})


@surveys_bp.route('/credits/me', methods=['GET'])
@jwt_required()
def my_credits():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    credit = ensure_credit(user.id)
    if not credit:
        return jsonify({'error': '크레딧 정보를 불러오지 못했습니다.'}), 500
    return jsonify({
        'base': credit.base,
        'earned': credit.earned,
        'used': credit.used,
        'available': credit.available,
    })
