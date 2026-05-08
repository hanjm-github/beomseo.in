"""
BOSPI category routes.
"""
from datetime import datetime

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required, verify_jwt_in_request
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from models import (
    BospiPendingPrediction,
    BospiPrediction,
    BospiPredictionDirection,
    BospiRecord,
    BospiUserScore,
    User,
    UserRole,
    db,
)
from models.bospi import BOSPI_REWARD_POINTS, today_kst
from utils.cache import cache_json_response, invalidate_cache_namespaces
from utils.security import get_current_user, require_role


bospi_bp = Blueprint('bospi', __name__, url_prefix='/api/community/bospi')


def optional_current_user():
    """Return the current user when a JWT exists; otherwise None."""
    try:
        verify_jwt_in_request(optional=True)
        user_id = get_jwt_identity()
        return User.query.get(int(user_id)) if user_id else None
    except Exception:
        return None


def manager_role(role):
    """Return True for roles allowed to operate BOSPI records."""
    return str(role or '') in {UserRole.ADMIN.value, UserRole.STUDENT_COUNCIL.value}


def role_value(role):
    """Return a normalized role value from either enum or plain string roles."""
    if hasattr(role, 'value'):
        return role.value
    return str(role or '')


def parse_date(value):
    """Parse YYYY-MM-DD payload values."""
    if not value:
        return None
    try:
        return datetime.strptime(str(value)[:10], '%Y-%m-%d').date()
    except (TypeError, ValueError):
        return None


def payload_value(data, *keys):
    """Return the first present payload value for a set of compatible field names."""
    for key in keys:
        if key in data:
            return data.get(key)
    return None


def parse_non_negative_int(value):
    """Parse a non-negative integer payload value."""
    if value is None or value == '' or isinstance(value, bool):
        return None
    try:
        numeric_value = float(value)
    except (TypeError, ValueError):
        return None
    if numeric_value < 0 or not numeric_value.is_integer():
        return None
    return int(numeric_value)


def calculate_ratio_from_counts(data):
    """Validate student counts and calculate the BOSPI percentage to four decimals."""
    baseline_count = parse_non_negative_int(
        payload_value(
            data,
            'baselineStudentCount',
            'baseline_student_count',
            'baseStudentCount',
            'standardStudentCount',
        )
    )
    uniformed_count = parse_non_negative_int(
        payload_value(
            data,
            'uniformedStudentCount',
            'uniformed_student_count',
            'uniformStudentCount',
        )
    )

    if baseline_count is None or baseline_count <= 0:
        return None, None, None, 'baselineStudentCount must be a positive integer'
    if uniformed_count is None:
        return None, None, None, 'uniformedStudentCount must be a non-negative integer'
    if uniformed_count > baseline_count:
        return None, None, None, 'uniformedStudentCount cannot exceed baselineStudentCount'

    ratio = round((uniformed_count / baseline_count) * 100, 4)
    return baseline_count, uniformed_count, ratio, None


def normalize_direction(value):
    """Normalize frontend prediction direction values."""
    text = str(value or '').strip().lower()
    if text in {BospiPredictionDirection.INCREASE.value, 'up'}:
        return BospiPredictionDirection.INCREASE
    if text in {BospiPredictionDirection.DECREASE.value, 'down'}:
        return BospiPredictionDirection.DECREASE
    return None


def load_records():
    """Return official BOSPI records in chronological order."""
    return BospiRecord.query.order_by(BospiRecord.operation_date.asc()).all()


def load_records_by_date():
    """Return official BOSPI records keyed by date."""
    return {record.operation_date: record for record in load_records()}


def load_latest_record():
    """Return the latest recorded BOSPI value."""
    return BospiRecord.query.order_by(BospiRecord.operation_date.desc()).first()


def load_latest_previous_record(target_date):
    """Return the latest official BOSPI record before the target date."""
    if not target_date:
        return None
    return (
        BospiRecord.query.filter(BospiRecord.operation_date < target_date)
        .order_by(BospiRecord.operation_date.desc())
        .first()
    )


def load_next_record(target_date):
    """Return the next official BOSPI record after the target date."""
    if not target_date:
        return None
    return (
        BospiRecord.query.filter(BospiRecord.operation_date > target_date)
        .order_by(BospiRecord.operation_date.asc())
        .first()
    )


def comparison_outcome(current_record, previous_record):
    """Return the direction label for two comparable official records."""
    if not current_record or not previous_record:
        return None
    if current_record.uniform_rate > previous_record.uniform_rate:
        return BospiPredictionDirection.INCREASE.value
    if current_record.uniform_rate < previous_record.uniform_rate:
        return BospiPredictionDirection.DECREASE.value
    return 'tie'


def serialize_comparisons(records):
    """Build comparison metadata without exposing the previous comparison date."""
    comparisons = []
    previous_record = None
    for record in records:
        comparisons.append(
            {
                'date': record.operation_date.isoformat(),
                'outcome': comparison_outcome(record, previous_record),
            }
        )
        previous_record = record
    return comparisons


def direction_value(direction):
    """Return the stored enum direction as a string."""
    return direction.value if hasattr(direction, 'value') else str(direction)


def serialize_next_prediction(prediction):
    """Return public next-prediction metadata for ranking rows."""
    if not prediction:
        return None
    return {
        'direction': direction_value(prediction.direction),
        'status': 'pending',
    }


def ensure_user_score_row(user_id):
    """Create the user's BOSPI score projection row if it is missing."""
    if not user_id:
        return None

    score = BospiUserScore.query.filter_by(user_id=user_id).first()
    if score:
        return score

    score = BospiUserScore(
        user_id=user_id,
        total_score=0,
        correct_count=0,
        incorrect_count=0,
    )
    db.session.add(score)
    return score


def recompute_score_for_user(user_id):
    """Rebuild one user's score projection from evaluated predictions."""
    score = ensure_user_score_row(user_id)
    if not score:
        return None

    predictions = (
        BospiPrediction.query.filter(
            BospiPrediction.user_id == user_id,
            BospiPrediction.evaluated_at.isnot(None),
        )
        .order_by(BospiPrediction.target_date.asc())
        .all()
    )
    score.total_score = sum(int(prediction.points_awarded or 0) for prediction in predictions)
    score.correct_count = sum(1 for prediction in predictions if prediction.is_correct is True)
    score.incorrect_count = sum(1 for prediction in predictions if prediction.is_correct is False)
    return score


def refresh_score_rows_for_users(user_ids):
    """Refresh score rows for all affected BOSPI participants."""
    for user_id in sorted({user_id for user_id in user_ids if user_id}):
        recompute_score_for_user(user_id)


def evaluate_predictions_for_date(target_date):
    """Evaluate all completed predictions for one recorded date."""
    target_record = BospiRecord.query.filter_by(operation_date=target_date).first()
    previous_record = load_latest_previous_record(target_date)
    outcome = comparison_outcome(target_record, previous_record)
    if outcome is None:
        return set()

    evaluated_at = datetime.utcnow()
    predictions = BospiPrediction.query.filter_by(target_date=target_date).all()
    affected_user_ids = set()
    for prediction in predictions:
        affected_user_ids.add(prediction.user_id)
        prediction.evaluated_at = evaluated_at
        if outcome == 'tie':
            prediction.is_correct = None
            prediction.points_awarded = 0
            continue

        prediction.is_correct = direction_value(prediction.direction) == outcome
        prediction.points_awarded = BOSPI_REWARD_POINTS if prediction.is_correct else 0

    return affected_user_ids


def materialize_pending_predictions(target_date):
    """Move every user's pending next-value prediction onto a concrete record date."""
    if load_latest_previous_record(target_date) is None:
        return 0

    # Pending predictions intentionally do not carry a date. The first new
    # official record after a previous baseline becomes their concrete target.
    pending_predictions = BospiPendingPrediction.query.order_by(
        BospiPendingPrediction.created_at.asc(),
        BospiPendingPrediction.id.asc(),
    ).all()
    materialized_count = 0

    for pending in pending_predictions:
        prediction = BospiPrediction.query.filter_by(
            user_id=pending.user_id,
            target_date=target_date,
        ).first()
        if prediction:
            prediction.direction = pending.direction
            prediction.points_awarded = 0
            prediction.is_correct = None
            prediction.evaluated_at = None
        else:
            prediction = BospiPrediction(
                user_id=pending.user_id,
                target_date=target_date,
                direction=pending.direction,
            )
            db.session.add(prediction)
        db.session.delete(pending)
        materialized_count += 1

    return materialized_count


def reevaluate_related_predictions(changed_date):
    """Recalculate predictions affected by a record insert/update."""
    affected_user_ids = set()
    affected_user_ids.update(evaluate_predictions_for_date(changed_date))
    next_record = load_next_record(changed_date)
    if next_record:
        affected_user_ids.update(evaluate_predictions_for_date(next_record.operation_date))
    return affected_user_ids


def total_score_for_user(user_id):
    """Return the user's accumulated BOSPI score."""
    if not user_id:
        return 0
    score = BospiUserScore.query.filter_by(user_id=user_id).first()
    return int(score.total_score or 0) if score else 0


def load_rankings(current_user_id=None):
    """Return public BOSPI ranking rows using the score projection table."""
    rows = (
        db.session.query(BospiUserScore, User, BospiPendingPrediction)
        .join(User, User.id == BospiUserScore.user_id)
        .outerjoin(
            BospiPendingPrediction,
            BospiPendingPrediction.user_id == BospiUserScore.user_id,
        )
        .order_by(
            BospiUserScore.total_score.desc(),
            BospiUserScore.correct_count.desc(),
            BospiUserScore.incorrect_count.asc(),
            User.nickname.asc(),
            BospiUserScore.user_id.asc(),
        )
        .all()
    )

    rankings = []
    current_rank = 0
    previous_score = None
    for index, (score, user, next_prediction) in enumerate(rows, start=1):
        total_score = int(score.total_score or 0)
        # Tied total scores share the same displayed rank; secondary ordering
        # only stabilizes row order within that displayed rank.
        if previous_score is None or total_score != previous_score:
            current_rank = index
            previous_score = total_score

        rankings.append(
            {
                'rank': current_rank,
                'userId': score.user_id,
                'nickname': user.nickname,
                'totalScore': total_score,
                'correctCount': int(score.correct_count or 0),
                'incorrectCount': int(score.incorrect_count or 0),
                'nextPrediction': serialize_next_prediction(next_prediction),
                'isCurrentUser': bool(current_user_id and score.user_id == current_user_id),
            }
        )

    return rankings


def load_completed_predictions_by_date(user_id, record_dates):
    """Return one user's evaluated BOSPI predictions keyed by target date."""
    if not user_id or not record_dates:
        return {}

    predictions = (
        BospiPrediction.query.filter(
            BospiPrediction.user_id == user_id,
            BospiPrediction.target_date.in_(record_dates),
        )
        .order_by(BospiPrediction.target_date.asc())
        .all()
    )
    return {prediction.target_date: prediction for prediction in predictions}


def serialize_state(current_user=None):
    """Build the BOSPI page payload."""
    records = load_records()
    record_dates = [record.operation_date for record in records]
    user_id = current_user.id if current_user else None
    completed_predictions_by_date = load_completed_predictions_by_date(user_id, record_dates)
    pending_prediction = (
        BospiPendingPrediction.query.filter_by(user_id=user_id).first()
        if user_id
        else None
    )

    return {
        'settings': {
            'rewardPoints': BOSPI_REWARD_POINTS,
        },
        'records': [record.to_dict() for record in records],
        'comparisons': serialize_comparisons(records),
        'predictionTargetDate': None,
        'predictionOpen': bool(records),
        'myPrediction': pending_prediction.to_dict() if pending_prediction else None,
        'myPredictions': [
            completed_predictions_by_date[record_date].to_dict()
            for record_date in record_dates
            if record_date in completed_predictions_by_date
        ],
        'myScore': total_score_for_user(user_id),
        'rankings': load_rankings(user_id),
        'canManage': manager_role(role_value(current_user.role) if current_user else None),
        'today': today_kst().isoformat(),
    }


@bospi_bp.route('', methods=['GET'])
@bospi_bp.route('/', methods=['GET'])
@cache_json_response('bospi', ttl=20)
def get_bospi_state():
    """Return BOSPI graph, records, pending prediction, and caller score."""
    current_user = optional_current_user()
    return jsonify(serialize_state(current_user))


@bospi_bp.route('/predictions', methods=['POST'])
@bospi_bp.route('/predictions/', methods=['POST'])
@jwt_required()
def submit_prediction():
    """Create or update the caller's pending prediction for the next BOSPI record."""
    data = request.get_json() or {}
    direction = normalize_direction(data.get('direction'))
    if direction is None:
        return jsonify({'error': 'direction must be increase or decrease'}), 422

    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404

    if load_latest_record() is None:
        return jsonify({'error': 'BOSPI records are required before predictions open'}), 422

    # Users can revise their next-value prediction until the next official
    # record is saved and the pending row is materialized.
    pending_prediction = BospiPendingPrediction.query.filter_by(user_id=user.id).first()
    status_code = 200
    if pending_prediction:
        pending_prediction.direction = direction
    else:
        pending_prediction = BospiPendingPrediction(
            user_id=user.id,
            direction=direction,
        )
        db.session.add(pending_prediction)
        status_code = 201
    ensure_user_score_row(user.id)

    try:
        db.session.commit()
        invalidate_cache_namespaces('bospi')
    except (IntegrityError, SQLAlchemyError):
        db.session.rollback()
        return jsonify({'error': 'Failed to save BOSPI prediction'}), 500

    return jsonify(serialize_state(user)), status_code


@bospi_bp.route('/records', methods=['POST'])
@bospi_bp.route('/records/', methods=['POST'])
@jwt_required()
@require_role(UserRole.ADMIN, UserRole.STUDENT_COUNCIL)
def save_record():
    """Create or update one official BOSPI ratio."""
    data = request.get_json() or {}
    operation_date = parse_date(data.get('date') or data.get('operationDate'))
    if not operation_date:
        return jsonify({'error': 'date is required'}), 422

    baseline_count, uniformed_count, ratio, error = calculate_ratio_from_counts(data)
    if error:
        return jsonify({'error': error}), 422

    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404

    record = BospiRecord.query.filter_by(operation_date=operation_date).first()
    is_new_record = record is None
    latest_record = load_latest_record()
    # New records must extend the official timeline. Existing dates can still
    # be corrected, which triggers score re-evaluation below.
    if is_new_record and latest_record and operation_date <= latest_record.operation_date:
        return jsonify({'error': 'date must be after the latest BOSPI record date'}), 422

    if record:
        record.uniform_rate = ratio
        record.baseline_student_count = baseline_count
        record.uniformed_student_count = uniformed_count
        record.entered_by_id = user.id
        record.entered_by_role = role_value(user.role)
    else:
        record = BospiRecord(
            operation_date=operation_date,
            uniform_rate=ratio,
            baseline_student_count=baseline_count,
            uniformed_student_count=uniformed_count,
            entered_by_id=user.id,
            entered_by_role=role_value(user.role),
        )
        db.session.add(record)

    try:
        db.session.flush()
        if is_new_record:
            materialize_pending_predictions(operation_date)
        # Updating one date can also change the outcome for the next recorded
        # date because BOSPI predictions compare adjacent official records.
        affected_user_ids = reevaluate_related_predictions(operation_date)
        refresh_score_rows_for_users(affected_user_ids)
        db.session.commit()
        invalidate_cache_namespaces('bospi')
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': 'Failed to save BOSPI record'}), 500

    return jsonify(serialize_state(user)), 200
