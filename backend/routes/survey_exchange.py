"""
Survey exchange routes.
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy.exc import SQLAlchemyError, IntegrityError

from models import db, SurveyExchange, SurveyResponse
from utils.pagination import parse_pagination
from utils.security import get_current_user

survey_exchange_bp = Blueprint('survey_exchange', __name__, url_prefix='/api/community/surveys')


@survey_exchange_bp.route('', methods=['GET'])
@survey_exchange_bp.route('/', methods=['GET'])
@jwt_required(optional=True)
def list_surveys():
    user = get_current_user()
    current_user_id = user.id if user else None
    mine = str(request.args.get('mine', '')).lower() in {'1', 'true', 'yes', 'on'}

    page, page_size = parse_pagination(request, default_page_size=12, max_page_size=50)
    q = SurveyExchange.query.filter(SurveyExchange.deleted_at.is_(None))
    if mine and current_user_id:
        q = q.filter(SurveyExchange.author_id == current_user_id)

    total = q.count()
    items = q.order_by(SurveyExchange.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    responded_ids = set()
    if current_user_id and items:
        survey_ids = [item.id for item in items]
        rows = SurveyResponse.query.filter(
            SurveyResponse.responder_id == current_user_id,
            SurveyResponse.survey_id.in_(survey_ids),
        ).all()
        responded_ids = {row.survey_id for row in rows}

    return jsonify({
        'items': [item.to_dict(current_user_id=current_user_id, has_responded=item.id in responded_ids) for item in items],
        'total': total,
        'page': page,
        'page_size': page_size,
    })


@survey_exchange_bp.route('', methods=['POST'])
@survey_exchange_bp.route('/', methods=['POST'])
@jwt_required()
def create_survey():
    user = get_current_user()
    if not user:
        return jsonify({'error': '인증이 필요합니다.'}), 401

    data = request.get_json(silent=True) or {}
    title = (data.get('title') or '').strip()
    description = (data.get('description') or '').strip()
    form_schema = data.get('formSchema')

    errors = []
    if len(title) < 2 or len(title) > 200:
        errors.append('제목은 2~200자로 입력해주세요.')
    if not isinstance(form_schema, list) or not form_schema:
        errors.append('설문 문항을 1개 이상 등록해주세요.')

    if errors:
        return jsonify({'error': errors[0], 'errors': errors}), 400

    survey = SurveyExchange(
        title=title,
        description=description[:1000] if description else None,
        form_schema=form_schema,
        author_id=user.id,
        author_role=user.role.value,
    )
    db.session.add(survey)
    db.session.commit()

    return jsonify(survey.to_dict(current_user_id=user.id)), 201


@survey_exchange_bp.route('/<int:survey_id>', methods=['GET'])
@jwt_required(optional=True)
def get_survey(survey_id):
    user = get_current_user()
    current_user_id = user.id if user else None

    survey = SurveyExchange.query.filter(
        SurveyExchange.id == survey_id,
        SurveyExchange.deleted_at.is_(None),
    ).first()
    if not survey:
        return jsonify({'error': '설문을 찾을 수 없습니다.'}), 404

    has_responded = False
    if current_user_id:
        has_responded = SurveyResponse.query.filter_by(survey_id=survey.id, responder_id=current_user_id).first() is not None

    return jsonify(survey.to_dict(current_user_id=current_user_id, has_responded=has_responded))


@survey_exchange_bp.route('/<int:survey_id>/responses', methods=['POST'])
@jwt_required()
def submit_response(survey_id):
    user = get_current_user()
    if not user:
        return jsonify({'error': '인증이 필요합니다.'}), 401

    survey = SurveyExchange.query.filter(
        SurveyExchange.id == survey_id,
        SurveyExchange.deleted_at.is_(None),
    ).first()
    if not survey:
        return jsonify({'error': '설문을 찾을 수 없습니다.'}), 404

    if survey.author_id == user.id:
        return jsonify({'error': '본인 설문에는 응답할 수 없습니다.'}), 400

    if survey.responses_count >= survey.response_limit:
        return jsonify({'error': '이 설문은 최대 응답 수에 도달했습니다.'}), 400

    data = request.get_json(silent=True) or {}
    answers = data.get('answers')
    if not isinstance(answers, list):
        return jsonify({'error': '응답 데이터 형식이 올바르지 않습니다.'}), 400

    exists = SurveyResponse.query.filter_by(survey_id=survey.id, responder_id=user.id).first()
    if exists:
        return jsonify({'error': '이미 이 설문에 응답했습니다.'}), 400

    response = SurveyResponse(survey_id=survey.id, responder_id=user.id, answers=answers)
    survey.responses_count += 1

    # Responding to others increases capacity of my own active surveys.
    my_surveys = SurveyExchange.query.filter(
        SurveyExchange.author_id == user.id,
        SurveyExchange.deleted_at.is_(None),
    ).all()
    for own_survey in my_surveys:
        own_survey.bonus_quota = (own_survey.bonus_quota or 0) + 1

    db.session.add(response)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({'error': '이미 응답한 설문입니다.'}), 409
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '응답 저장 중 오류가 발생했습니다.'}), 500

    return jsonify({
        'ok': True,
        'surveyId': survey.id,
        'responsesCount': survey.responses_count,
        'responseLimit': survey.response_limit,
        'remainingSlots': survey.remaining_slots,
        'myBonusIncreasedBy': len(my_surveys),
    }), 201
