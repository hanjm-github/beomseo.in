"""
Study With Beomseo leaderboard domain logic.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy.orm import joinedload

from models import StudyWithBeomseoScoreUpdate, User, UserRole, db
from models.study_with_beomseo import KST, to_kst_iso


CLASS_SCORE_MIN = 0
CLASS_SCORE_MAX = 1_000_000
MANAGER_ROLES = {UserRole.ADMIN.value, UserRole.STUDENT_COUNCIL.value}
# The contest scope is fixed to the current school structure: grades 1-3,
# classes 1-10. Generating it here keeps backend validation and frontend
# display data aligned without a database lookup.
CLASS_OPTIONS = tuple(
    {
        'classId': f'{grade}-{class_number}',
        'grade': grade,
        'classNumber': class_number,
        'label': f'{grade}-{class_number}',
    }
    for grade in range(1, 4)
    for class_number in range(1, 11)
)


class StudyWithBeomseoValidationError(ValueError):
    """Raised when client-provided leaderboard input is invalid."""


@dataclass(frozen=True)
class ParsedClass:
    class_id: str
    grade: int
    class_number: int


def now_kst_naive() -> datetime:
    """Return the current KST wall-clock time as a naive datetime."""
    return datetime.now(KST).replace(tzinfo=None)


def role_value(role) -> str:
    """Return a plain role value for enum/string role inputs."""
    if hasattr(role, 'value'):
        return role.value
    return str(role or '')


def can_manage(user: User | None) -> bool:
    """Return True when the user may manage Study With Beomseo scores."""
    return role_value(user.role) in MANAGER_ROLES if user else False


def parse_class_id(value) -> ParsedClass:
    """Validate and parse a class id such as 2-7."""
    text = str(value or '').strip()
    parts = text.split('-')
    if len(parts) != 2:
        raise StudyWithBeomseoValidationError('classId는 1-1부터 3-10 사이여야 합니다.')

    try:
        grade = int(parts[0])
        class_number = int(parts[1])
    except (TypeError, ValueError) as exc:
        raise StudyWithBeomseoValidationError('classId는 1-1부터 3-10 사이여야 합니다.') from exc

    if grade < 1 or grade > 3 or class_number < 1 or class_number > 10:
        raise StudyWithBeomseoValidationError('classId는 1-1부터 3-10 사이여야 합니다.')

    return ParsedClass(class_id=f'{grade}-{class_number}', grade=grade, class_number=class_number)


def parse_total_score(value) -> int:
    """Validate total score as an integer in the public leaderboard range."""
    if value is None or value == '' or isinstance(value, bool):
        raise StudyWithBeomseoValidationError('totalScore는 0 이상의 정수여야 합니다.')

    if isinstance(value, int):
        total_score = value
    elif isinstance(value, float) and value.is_integer():
        total_score = int(value)
    elif isinstance(value, str):
        text = value.strip()
        if not text or not text.isdigit():
            raise StudyWithBeomseoValidationError('totalScore는 0 이상의 정수여야 합니다.')
        total_score = int(text)
    else:
        raise StudyWithBeomseoValidationError('totalScore는 0 이상의 정수여야 합니다.')

    if total_score < CLASS_SCORE_MIN or total_score > CLASS_SCORE_MAX:
        raise StudyWithBeomseoValidationError('totalScore는 0부터 1000000 사이여야 합니다.')
    return total_score


def parse_effective_at(value) -> datetime:
    """
    Parse an ISO datetime and normalize it to KST-naive storage.

    Timezone-aware input is converted to KST. Timezone-less input is treated as
    already being KST, matching the countdown event storage convention.
    """
    if value is None or str(value).strip() == '':
        raise StudyWithBeomseoValidationError('effectiveAt이 필요합니다.')

    text = str(value).strip()
    try:
        parsed = datetime.fromisoformat(text.replace('Z', '+00:00'))
    except (TypeError, ValueError) as exc:
        raise StudyWithBeomseoValidationError('effectiveAt은 ISO 날짜시간이어야 합니다.') from exc

    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=None)

    return parsed.astimezone(KST).replace(tzinfo=None)


def load_latest_published_by_class(now_value: datetime) -> dict[str, StudyWithBeomseoScoreUpdate]:
    """Return the latest public score update for each class."""
    rows = (
        StudyWithBeomseoScoreUpdate.query.filter(
            StudyWithBeomseoScoreUpdate.effective_at <= now_value,
        )
        .order_by(
            StudyWithBeomseoScoreUpdate.class_id.asc(),
            StudyWithBeomseoScoreUpdate.effective_at.desc(),
            StudyWithBeomseoScoreUpdate.id.desc(),
        )
        .all()
    )

    # The ORDER BY places the latest row for a class first; setdefault keeps
    # that first row and ignores older snapshots for the same class.
    latest_by_class = {}
    for row in rows:
        latest_by_class.setdefault(row.class_id, row)
    return latest_by_class


def build_ranked_rows(latest_by_class: dict[str, StudyWithBeomseoScoreUpdate]) -> list[dict]:
    """Build all 30 leaderboard rows with competition-style tied ranks."""
    rows = []
    for option in CLASS_OPTIONS:
        update = latest_by_class.get(option['classId'])
        rows.append(
            {
                'classId': option['classId'],
                'grade': option['grade'],
                'classNumber': option['classNumber'],
                'label': option['label'],
                'rank': 0,
                'totalScore': int(update.total_score or 0) if update else 0,
                'lastPublishedAt': to_kst_iso(update.effective_at) if update else None,
            }
        )

    rows.sort(key=lambda item: (-item['totalScore'], item['grade'], item['classNumber']))

    # Competition ranking leaves gaps after ties: 1, 1, 3 rather than 1, 1, 2.
    previous_score = None
    current_rank = 0
    for index, row in enumerate(rows, start=1):
        if previous_score is None or row['totalScore'] != previous_score:
            current_rank = index
            previous_score = row['totalScore']
        row['rank'] = current_rank

    return rows


def load_pending_updates(now_value: datetime) -> list[dict]:
    """Return manager-only future score updates."""
    rows = (
        StudyWithBeomseoScoreUpdate.query.options(
            joinedload(StudyWithBeomseoScoreUpdate.created_by),
        )
        .filter(StudyWithBeomseoScoreUpdate.effective_at > now_value)
        .order_by(
            StudyWithBeomseoScoreUpdate.effective_at.asc(),
            StudyWithBeomseoScoreUpdate.grade.asc(),
            StudyWithBeomseoScoreUpdate.class_number.asc(),
            StudyWithBeomseoScoreUpdate.id.asc(),
        )
        .all()
    )
    return [row.to_update_dict() for row in rows]


def build_scoreboard_payload(current_user: User | None = None, now_value: datetime | None = None) -> dict:
    """Build the complete scoreboard payload for public or manager viewers."""
    now_value = now_value or now_kst_naive()
    latest_by_class = load_latest_published_by_class(now_value)
    updated_through = max(
        (row.effective_at for row in latest_by_class.values()),
        default=None,
    )
    manager_mode = can_manage(current_user)

    payload = {
        'serverNow': to_kst_iso(now_value),
        'updatedThrough': to_kst_iso(updated_through),
        'canManage': manager_mode,
        'items': build_ranked_rows(latest_by_class),
        'pendingUpdates': [],
    }

    if manager_mode:
        payload['pendingUpdates'] = load_pending_updates(now_value)

    return payload


def create_score_update(data: dict, current_user: User) -> StudyWithBeomseoScoreUpdate:
    """Validate payload and append a scheduled total-score update."""
    # Updates are snapshots, not deltas. Keeping every row preserves the public
    # release history and lets future effective_at values act as scheduled posts.
    parsed_class = parse_class_id(data.get('classId') or data.get('class_id'))
    total_score = parse_total_score(data.get('totalScore', data.get('total_score')))
    effective_at = parse_effective_at(data.get('effectiveAt') or data.get('effective_at'))

    update = StudyWithBeomseoScoreUpdate(
        class_id=parsed_class.class_id,
        grade=parsed_class.grade,
        class_number=parsed_class.class_number,
        total_score=total_score,
        effective_at=effective_at,
        created_by_id=current_user.id,
        created_by_role=role_value(current_user.role),
    )
    db.session.add(update)
    return update
