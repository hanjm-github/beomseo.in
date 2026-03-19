"""
Idempotent seed helpers for field-trip classes.
"""
from __future__ import annotations

from field_trip_seed import FIELD_TRIP_DEFAULT_CLASSES
from models import FieldTripClass, db
from utils.security import hash_password


LEGACY_FIELD_TRIP_DEFAULT_SCORES = {
    '1': 84,
    '2': 76,
    '3': 91,
    '4': 68,
    '5': 88,
    '6': 73,
    '7': 95,
    '8': 64,
    '9': 79,
    '10': 86,
}


def bootstrap_field_trip_defaults(session=None) -> dict:
    """
    Ensure the 10 default class rows exist.

    Labels and passwords are only backfilled when missing. Scores are initialized
    from the current seed, and legacy seed scores are migrated once to the new
    zero-based defaults.
    """
    active_session = session or db.session
    created = 0
    backfilled = 0

    existing_rows = {
        row.class_id: row
        for row in active_session.query(FieldTripClass).all()
    }

    has_complete_legacy_scores = (
        len(existing_rows) == len(LEGACY_FIELD_TRIP_DEFAULT_SCORES)
        and all(
            int((existing_rows[class_id].total_score or 0)) == legacy_score
            for class_id, legacy_score in LEGACY_FIELD_TRIP_DEFAULT_SCORES.items()
        )
    )

    for item in FIELD_TRIP_DEFAULT_CLASSES:
        class_id = item['classId']
        row = existing_rows.get(class_id)

        if row is None:
            active_session.add(
                FieldTripClass(
                    class_id=class_id,
                    label=item['label'],
                    password_hash=hash_password(item['password']),
                    total_score=item['totalScore'],
                )
            )
            created += 1
            continue

        row_changed = False
        if not row.label:
            row.label = item['label']
            row_changed = True
        if not row.password_hash:
            row.password_hash = hash_password(item['password'])
            row_changed = True
        if row.total_score is None or has_complete_legacy_scores:
            row.total_score = item['totalScore']
            row_changed = True
        if row_changed:
            backfilled += 1

    active_session.commit()
    return {
        'created': created,
        'backfilled': backfilled,
        'totalClasses': len(FIELD_TRIP_DEFAULT_CLASSES),
    }
