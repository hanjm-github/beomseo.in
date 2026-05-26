"""
Study With Beomseo class leaderboard routes.
"""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from sqlalchemy.exc import SQLAlchemyError

from models import UserRole, db
from services.study_with_beomseo import (
    StudyWithBeomseoValidationError,
    build_scoreboard_payload,
    create_score_update,
)
from utils.security import get_current_user, require_role


study_with_beomseo_bp = Blueprint(
    'study_with_beomseo',
    __name__,
    url_prefix='/api/community/study-with-beomseo',
)


@study_with_beomseo_bp.route('/scoreboard', methods=['GET'])
def get_scoreboard():
    """Return public leaderboard rows plus manager-only pending updates."""
    # Optional identity controls whether future scheduled updates are included;
    # public callers still receive the same ranked 30-class payload.
    current_user = get_current_user()
    return jsonify(build_scoreboard_payload(current_user)), 200


@study_with_beomseo_bp.route('/score-updates', methods=['POST'])
@jwt_required()
@require_role(UserRole.ADMIN, UserRole.STUDENT_COUNCIL)
def schedule_score_update():
    """Append a scheduled total-score update for a class."""
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({'error': 'Request body is required'}), 400
    if not isinstance(data, dict):
        return jsonify({'error': 'Request body must be a JSON object'}), 400

    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'User not found'}), 404

    try:
        update = create_score_update(data, current_user)
        db.session.commit()
    except StudyWithBeomseoValidationError as exc:
        # Validation errors are client-fixable, so they use 422 and keep the
        # append-only update table unchanged.
        db.session.rollback()
        return jsonify({'error': str(exc)}), 422
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': '점수 공개 예약을 저장하지 못했습니다.'}), 500

    return jsonify(update.to_update_dict()), 201
