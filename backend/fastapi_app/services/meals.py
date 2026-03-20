"""
Async school meal sync and read logic backed by the NEIS meal API.
"""
from __future__ import annotations

import asyncio
import hashlib
import html
import json
import re
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation

import httpx
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import Settings
from ..models import SchoolMeal, SchoolMealRating, User
from ..utils import sanitize_plain_text


KST = timezone(timedelta(hours=9))
NEIS_DATE_FORMAT = '%Y%m%d'
LUNCH_SERVICE = 'lunch'
LUNCH_MEAL_TYPE_CODE = '2'
LUNCH_MEAL_TYPE_NAME = '중식'
EMPTY_PREVIEW_TEXT = '급식 정보가 없습니다.'
EMPTY_NOTE_TEXT = '주말, 휴일 또는 미제공일입니다.'
DEFAULT_NOTE_TEXT = '원산지/영양 정보 제공'
MEAL_RATING_CATEGORIES = ('taste', 'anticipation')
BR_TAG_RE = re.compile(r'<br\s*/?>', re.IGNORECASE)
HTML_TAG_RE = re.compile(r'<[^>]+>')
CALORIE_RE = re.compile(r'(\d+(?:\.\d+)?)')


class SchoolMealError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


@dataclass(slots=True)
class MealSyncStats:
    requestedFrom: str
    requestedTo: str
    fetchedRows: int
    normalizedRows: int
    created: int
    updated: int
    unchanged: int
    pruned: int
    dryRun: bool
    allowEmpty: bool
    syncedAt: str


def _utc_now_naive() -> datetime:
    return datetime.utcnow()


def _kst_today() -> date:
    return datetime.now(KST).date()


def _iso_utc(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    else:
        value = value.astimezone(timezone.utc)
    return value.isoformat().replace('+00:00', 'Z')


def _parse_neis_date(value: str | None, field_name: str) -> date:
    if not value:
        raise SchoolMealError(f'NEIS 응답에 {field_name} 값이 없습니다.', 502)
    try:
        return datetime.strptime(str(value), NEIS_DATE_FORMAT).date()
    except ValueError as exc:
        raise SchoolMealError(f'NEIS 응답의 {field_name} 값이 올바르지 않습니다.', 502) from exc


def _split_br_text(raw_value: str | None) -> list[str]:
    if not raw_value:
        return []
    normalized = BR_TAG_RE.sub('\n', str(raw_value))
    normalized = HTML_TAG_RE.sub('', normalized)
    parts = [
        sanitize_plain_text(html.unescape(part))
        for part in normalized.split('\n')
    ]
    return [part for part in parts if part]


def _truncate(value: str, max_length: int) -> str:
    return sanitize_plain_text(value, max_length=max_length)


def _parse_calories_kcal(raw_value: str | None) -> Decimal | None:
    if not raw_value:
        return None
    match = CALORIE_RE.search(str(raw_value))
    if not match:
        return None
    try:
        return Decimal(match.group(1))
    except (InvalidOperation, ValueError):
        return None


def _json_dump(value: list[str]) -> str:
    return json.dumps(value, ensure_ascii=False)


def _meal_status(target_date: date, *, is_no_meal: bool, reference_date: date) -> str:
    if is_no_meal:
        return 'empty'
    if target_date == reference_date:
        return 'today'
    if target_date < reference_date:
        return 'past'
    return 'upcoming'


def _empty_rating_summary() -> dict:
    return {
        'averageScore': None,
        'totalCount': 0,
        'myScore': None,
        'distribution': [
            {'score': score, 'count': 0, 'ratio': 0}
            for score in range(1, 6)
        ],
    }


def _empty_ratings() -> dict[str, dict]:
    return {
        category: _empty_rating_summary()
        for category in MEAL_RATING_CATEGORIES
    }


def _viewer_rating_key(
    settings: Settings,
    *,
    current_user: User | None,
    anonymous_token: str | None,
) -> str:
    if current_user is not None:
        seed = f'user:{int(current_user.id)}'
    else:
        normalized_token = sanitize_plain_text(anonymous_token, max_length=255)
        if not normalized_token:
            raise SchoolMealError('평가에 필요한 브라우저 식별 토큰이 없습니다.', 400)
        seed = f'anon:{normalized_token}'

    secret = settings.JWT_SECRET_KEY or settings.NEIS_API or 'meal-rating'
    return hashlib.sha256(f'{secret}|meal-rating|{seed}'.encode('utf-8')).hexdigest()


def _finalize_rating_summary(summary: dict) -> dict:
    total_count = int(summary.get('totalCount') or 0)
    weighted_total = int(summary.pop('_weightedTotal', 0))
    if total_count > 0:
        summary['averageScore'] = round(weighted_total / total_count, 1)
        for bucket in summary['distribution']:
            bucket['ratio'] = round((int(bucket['count']) / total_count) * 100)
    else:
        summary['averageScore'] = None
    return summary


def _build_ratings_payload(
    aggregate_rows: list[tuple[date, str, int, int]],
    viewer_rows: list[tuple[date, str, int]],
) -> dict[date, dict]:
    ratings_by_date: dict[date, dict] = {}

    for meal_date, category, score, count in aggregate_rows:
        if category not in MEAL_RATING_CATEGORIES:
            continue
        ratings = ratings_by_date.setdefault(meal_date, _empty_ratings())
        summary = ratings[category]
        bucket = summary['distribution'][int(score) - 1]
        bucket['count'] = int(count)
        summary['totalCount'] += int(count)
        summary['_weightedTotal'] = int(summary.get('_weightedTotal', 0)) + (int(score) * int(count))

    for meal_date, ratings in ratings_by_date.items():
        for category in MEAL_RATING_CATEGORIES:
            ratings[category] = _finalize_rating_summary(ratings[category])

    for meal_date, category, score in viewer_rows:
        if category not in MEAL_RATING_CATEGORIES:
            continue
        ratings = ratings_by_date.setdefault(meal_date, _empty_ratings())
        ratings[category]['myScore'] = int(score)

    return ratings_by_date


async def get_meal_ratings_payload(
    session: AsyncSession,
    *,
    start_date: date,
    end_date: date,
    viewer_key: str | None,
) -> dict[date, dict]:
    try:
        aggregate_result = await session.execute(
            select(
                SchoolMealRating.meal_date,
                SchoolMealRating.category,
                SchoolMealRating.score,
                func.count(SchoolMealRating.id),
            )
            .where(
                SchoolMealRating.meal_date >= start_date,
                SchoolMealRating.meal_date <= end_date,
            )
            .group_by(
                SchoolMealRating.meal_date,
                SchoolMealRating.category,
                SchoolMealRating.score,
            )
        )
        aggregate_rows = [
            (meal_date, category, int(score), int(count))
            for meal_date, category, score, count in aggregate_result.all()
        ]

        viewer_rows: list[tuple[date, str, int]] = []
        if viewer_key:
            viewer_result = await session.execute(
                select(
                    SchoolMealRating.meal_date,
                    SchoolMealRating.category,
                    SchoolMealRating.score,
                ).where(
                    SchoolMealRating.meal_date >= start_date,
                    SchoolMealRating.meal_date <= end_date,
                    SchoolMealRating.voter_key == viewer_key,
                )
            )
            viewer_rows = [
                (meal_date, category, int(score))
                for meal_date, category, score in viewer_result.all()
            ]
    except SQLAlchemyError as exc:
        raise SchoolMealError('급식 평점 데이터를 읽지 못했습니다.', 500) from exc

    return _build_ratings_payload(aggregate_rows, viewer_rows)


def _build_empty_entry(target_date: date, reference_date: date) -> dict:
    return {
        'id': f'meal-{target_date.isoformat()}',
        'date': target_date.isoformat(),
        'status': _meal_status(target_date, is_no_meal=True, reference_date=reference_date),
        'service': LUNCH_SERVICE,
        'serviceLabel': LUNCH_MEAL_TYPE_NAME,
        'menuItems': [],
        'previewText': EMPTY_PREVIEW_TEXT,
        'note': EMPTY_NOTE_TEXT,
        'isNoMeal': True,
        'calorieText': None,
        'caloriesKcal': None,
        'originItems': [],
        'nutritionItems': [],
        'ratings': _empty_ratings(),
        'syncedAt': None,
    }


def _serialize_meal_entry(meal: SchoolMeal, reference_date: date) -> dict:
    calories_value = meal.calories_kcal
    if isinstance(calories_value, Decimal):
        calories_value = float(calories_value)
    elif calories_value is not None:
        calories_value = float(calories_value)

    return {
        'id': f'meal-{meal.meal_date.isoformat()}',
        'date': meal.meal_date.isoformat(),
        'status': _meal_status(meal.meal_date, is_no_meal=False, reference_date=reference_date),
        'service': LUNCH_SERVICE,
        'serviceLabel': LUNCH_MEAL_TYPE_NAME,
        'menuItems': meal.menu_items(),
        'previewText': meal.preview_text,
        'note': meal.note_text,
        'isNoMeal': False,
        'calorieText': meal.calorie_text,
        'caloriesKcal': calories_value,
        'originItems': meal.origin_items(),
        'nutritionItems': meal.nutrition_items(),
        'ratings': _empty_ratings(),
        'syncedAt': _iso_utc(meal.synced_at),
    }


def normalize_neis_meal_row(row: dict) -> dict:
    menu_items = _split_br_text(row.get('DDISH_NM'))
    preview_text = _truncate(' · '.join(menu_items[:3]) or EMPTY_PREVIEW_TEXT, 255)

    calorie_text = sanitize_plain_text(row.get('CAL_INFO'), max_length=64) or None
    calories_kcal = _parse_calories_kcal(calorie_text)
    note_text = _truncate(
        f'칼로리 {calorie_text}' if calorie_text else DEFAULT_NOTE_TEXT,
        255,
    )

    origin_items = _split_br_text(row.get('ORPLC_INFO'))
    nutrition_items = _split_br_text(row.get('NTR_INFO'))
    meal_service_figure = row.get('MLSV_FGR')
    meal_service_figure_raw = None
    if meal_service_figure not in (None, ''):
        try:
            meal_service_figure_raw = Decimal(str(meal_service_figure))
        except (InvalidOperation, ValueError):
            meal_service_figure_raw = None

    return {
        'meal_date': _parse_neis_date(row.get('MLSV_YMD'), 'MLSV_YMD'),
        'meal_type_code': sanitize_plain_text(row.get('MMEAL_SC_CODE'), max_length=4) or LUNCH_MEAL_TYPE_CODE,
        'meal_type_name': sanitize_plain_text(row.get('MMEAL_SC_NM'), max_length=32) or LUNCH_MEAL_TYPE_NAME,
        'office_code': _truncate(str(row.get('ATPT_OFCDC_SC_CODE') or ''), 16),
        'office_name': _truncate(str(row.get('ATPT_OFCDC_SC_NM') or ''), 64),
        'school_code': _truncate(str(row.get('SD_SCHUL_CODE') or ''), 16),
        'school_name': _truncate(str(row.get('SCHUL_NM') or ''), 128),
        'dish_html': str(row.get('DDISH_NM') or ''),
        'menu_items_json': _json_dump(menu_items),
        'preview_text': preview_text,
        'note_text': note_text,
        'calorie_text': calorie_text,
        'calories_kcal': calories_kcal,
        'origin_items_json': _json_dump(origin_items),
        'nutrition_items_json': _json_dump(nutrition_items),
        'meal_service_figure_raw': meal_service_figure_raw,
        'source_from_ymd': sanitize_plain_text(row.get('MLSV_FROM_YMD'), max_length=8) or None,
        'source_to_ymd': sanitize_plain_text(row.get('MLSV_TO_YMD'), max_length=8) or None,
        'source_load_ymd': sanitize_plain_text(row.get('LOAD_DTM'), max_length=8) or None,
    }


def _extract_rows_from_neis_payload(payload: dict) -> tuple[list[dict], int | None]:
    if not isinstance(payload, dict):
        raise SchoolMealError('NEIS 응답 형식이 올바르지 않습니다.', 502)

    top_level_result = payload.get('RESULT')
    if isinstance(top_level_result, dict):
        code = str(top_level_result.get('CODE') or '')
        message = str(top_level_result.get('MESSAGE') or 'NEIS 요청이 실패했습니다.')
        if code == 'INFO-200':
            return [], 0
        raise SchoolMealError(f'NEIS 요청 실패: {message}', 502)

    dataset = payload.get('mealServiceDietInfo')
    if not isinstance(dataset, list) or not dataset:
        raise SchoolMealError('NEIS 응답에 mealServiceDietInfo가 없습니다.', 502)

    head_block = dataset[0].get('head') if isinstance(dataset[0], dict) else None
    total_count = None
    if isinstance(head_block, list) and head_block:
        if isinstance(head_block[0], dict):
            raw_total = head_block[0].get('list_total_count')
            if raw_total is not None:
                try:
                    total_count = int(raw_total)
                except (TypeError, ValueError):
                    total_count = None
        if len(head_block) > 1 and isinstance(head_block[1], dict):
            result = head_block[1].get('RESULT') or {}
            code = str(result.get('CODE') or '')
            message = str(result.get('MESSAGE') or 'NEIS 요청이 실패했습니다.')
            if code == 'INFO-200':
                return [], total_count
            if code and code != 'INFO-000':
                raise SchoolMealError(f'NEIS 요청 실패: {message}', 502)

    if len(dataset) < 2 or not isinstance(dataset[1], dict):
        return [], total_count

    rows = dataset[1].get('row') or []
    if not isinstance(rows, list):
        raise SchoolMealError('NEIS 응답 row 형식이 올바르지 않습니다.', 502)
    return rows, total_count


async def _fetch_neis_page(
    client: httpx.AsyncClient,
    settings: Settings,
    *,
    pindex: int,
    start_date: date,
    end_date: date,
) -> tuple[list[dict], int | None]:
    params = {
        'KEY': settings.NEIS_API,
        'Type': 'json',
        'pIndex': pindex,
        'pSize': 100,
        'ATPT_OFCDC_SC_CODE': settings.ATPT_OFCDC_SC_CODE,
        'SD_SCHUL_CODE': settings.SD_SCHUL_CODE,
        'MLSV_FROM_YMD': start_date.strftime(NEIS_DATE_FORMAT),
        'MLSV_TO_YMD': end_date.strftime(NEIS_DATE_FORMAT),
    }

    last_error: Exception | None = None
    for attempt in range(settings.NEIS_MAX_RETRIES):
        try:
            response = await client.get(settings.NEIS_MEAL_API_URL, params=params)
            response.raise_for_status()
            payload = response.json()
            return _extract_rows_from_neis_payload(payload)
        except (httpx.HTTPError, ValueError) as exc:
            last_error = exc
            if attempt == settings.NEIS_MAX_RETRIES - 1:
                break
            await asyncio.sleep(0.5 * (attempt + 1))

    raise SchoolMealError('NEIS 급식 데이터를 불러오지 못했습니다.', 502) from last_error


async def fetch_neis_meal_rows(
    settings: Settings,
    *,
    start_date: date,
    end_date: date,
    client: httpx.AsyncClient | None = None,
) -> list[dict]:
    if not settings.NEIS_API or not settings.ATPT_OFCDC_SC_CODE or not settings.SD_SCHUL_CODE:
        raise SchoolMealError('NEIS 급식 연동 설정이 누락되었습니다.', 500)

    close_client = client is None
    if client is None:
        client = httpx.AsyncClient(timeout=settings.NEIS_REQUEST_TIMEOUT_SECONDS)

    rows: list[dict] = []
    total_count: int | None = None
    page_index = 1

    try:
        while True:
            page_rows, page_total = await _fetch_neis_page(
                client,
                settings,
                pindex=page_index,
                start_date=start_date,
                end_date=end_date,
            )
            if total_count is None:
                total_count = page_total

            rows.extend(page_rows)

            if not page_rows:
                break
            if total_count is not None and len(rows) >= total_count:
                break
            if len(page_rows) < 100:
                break
            page_index += 1
    finally:
        if close_client:
            await client.aclose()

    filtered_rows = [
        row for row in rows
        if sanitize_plain_text(row.get('MMEAL_SC_CODE'), max_length=4) == LUNCH_MEAL_TYPE_CODE
    ]
    filtered_rows.sort(key=lambda item: str(item.get('MLSV_YMD') or ''))
    return filtered_rows


def _date_range(start_date: date, end_date: date) -> list[date]:
    days = (end_date - start_date).days
    return [start_date + timedelta(days=offset) for offset in range(days + 1)]


def _scope_dates_for_year(year: int) -> tuple[date, date]:
    return date(year, 1, 1), date(year, 12, 31)


def resolve_sync_scope(
    *,
    year: int | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
) -> tuple[date, date]:
    if year is not None:
        return _scope_dates_for_year(year)
    if start_date is None or end_date is None:
        raise SchoolMealError('동기화 범위가 지정되지 않았습니다.', 400)
    if start_date > end_date:
        raise SchoolMealError('동기화 시작일은 종료일보다 늦을 수 없습니다.', 422)
    return start_date, end_date


def _assign_model_fields(meal: SchoolMeal, payload: dict, synced_at: datetime) -> bool:
    changed = False
    for field_name, value in payload.items():
        if getattr(meal, field_name) != value:
            setattr(meal, field_name, value)
            changed = True
    if meal.synced_at != synced_at:
        meal.synced_at = synced_at
        changed = True
    return changed


async def apply_school_meal_sync(
    session: AsyncSession,
    *,
    normalized_meals: list[dict],
    scope_start: date,
    scope_end: date,
    synced_at: datetime,
    dry_run: bool = False,
) -> MealSyncStats:
    deduped_by_key = {
        (meal['meal_date'], meal['meal_type_code']): meal
        for meal in normalized_meals
    }
    existing_result = await session.execute(
        select(SchoolMeal).where(
            SchoolMeal.meal_date >= scope_start,
            SchoolMeal.meal_date <= scope_end,
            SchoolMeal.meal_type_code == LUNCH_MEAL_TYPE_CODE,
        )
    )
    existing_rows = list(existing_result.scalars().all())
    existing_by_key = {
        (meal.meal_date, meal.meal_type_code): meal
        for meal in existing_rows
    }

    created = 0
    updated = 0
    unchanged = 0

    for key, payload in deduped_by_key.items():
        existing = existing_by_key.get(key)
        if existing is None:
            created += 1
            if not dry_run:
                session.add(SchoolMeal(**payload, synced_at=synced_at))
            continue

        if _assign_model_fields(existing, payload, synced_at):
            updated += 1
        else:
            unchanged += 1

    stale_keys = set(existing_by_key) - set(deduped_by_key)
    pruned = len(stale_keys)
    if not dry_run:
        for key in stale_keys:
            await session.delete(existing_by_key[key])

    return MealSyncStats(
        requestedFrom=scope_start.isoformat(),
        requestedTo=scope_end.isoformat(),
        fetchedRows=len(normalized_meals),
        normalizedRows=len(deduped_by_key),
        created=created,
        updated=updated,
        unchanged=unchanged,
        pruned=pruned,
        dryRun=dry_run,
        allowEmpty=False,
        syncedAt=_iso_utc(synced_at) or '',
    )


async def sync_school_meals(
    session: AsyncSession,
    settings: Settings,
    *,
    year: int | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    dry_run: bool = False,
    allow_empty: bool = False,
    client: httpx.AsyncClient | None = None,
) -> MealSyncStats:
    scope_start, scope_end = resolve_sync_scope(
        year=year,
        start_date=start_date,
        end_date=end_date,
    )
    fetched_rows = await fetch_neis_meal_rows(
        settings,
        start_date=scope_start,
        end_date=scope_end,
        client=client,
    )
    normalized_meals = [normalize_neis_meal_row(row) for row in fetched_rows]

    if not normalized_meals and not allow_empty:
        raise SchoolMealError('NEIS에서 동기화할 중식 데이터가 없습니다.', 502)

    synced_at = _utc_now_naive()
    try:
        stats = await apply_school_meal_sync(
            session,
            normalized_meals=normalized_meals,
            scope_start=scope_start,
            scope_end=scope_end,
            synced_at=synced_at,
            dry_run=dry_run,
        )
        stats.allowEmpty = allow_empty
        stats.fetchedRows = len(fetched_rows)
        stats.normalizedRows = len(normalized_meals)
        if dry_run:
            await session.rollback()
        else:
            await session.commit()
        return stats
    except SQLAlchemyError as exc:
        await session.rollback()
        raise SchoolMealError('급식 동기화 중 데이터베이스 오류가 발생했습니다.', 500) from exc


def validate_meal_range(start_date: date, end_date: date, *, max_days: int) -> None:
    if start_date > end_date:
        raise SchoolMealError('조회 시작일은 종료일보다 늦을 수 없습니다.', 422)
    if (end_date - start_date).days + 1 > max_days:
        raise SchoolMealError(f'급식 조회 범위는 최대 {max_days}일까지 가능합니다.', 422)


async def get_school_meal_for_date(
    session: AsyncSession,
    *,
    target_date: date,
) -> SchoolMeal | None:
    try:
        result = await session.execute(
            select(SchoolMeal).where(
                SchoolMeal.meal_date == target_date,
                SchoolMeal.meal_type_code == LUNCH_MEAL_TYPE_CODE,
            )
        )
        return result.scalar_one_or_none()
    except SQLAlchemyError as exc:
        raise SchoolMealError('급식 데이터를 읽지 못했습니다.', 500) from exc


async def get_today_meal_payload(
    session: AsyncSession,
    *,
    settings: Settings,
    current_user: User | None,
    anonymous_token: str | None,
) -> dict:
    reference_date = _kst_today()
    viewer_key = _viewer_rating_key(
        settings,
        current_user=current_user,
        anonymous_token=anonymous_token,
    )
    meal = await get_school_meal_for_date(session, target_date=reference_date)
    item = _serialize_meal_entry(meal, reference_date) if meal else _build_empty_entry(reference_date, reference_date)
    ratings_by_date = await get_meal_ratings_payload(
        session,
        start_date=reference_date,
        end_date=reference_date,
        viewer_key=viewer_key,
    )
    item['ratings'] = ratings_by_date.get(reference_date, _empty_ratings())
    return {
        'item': item,
        'meta': {
            'date': reference_date.isoformat(),
            'generatedAt': _iso_utc(_utc_now_naive()),
            'timezone': 'Asia/Seoul',
        },
    }


async def get_meal_range_payload(
    session: AsyncSession,
    *,
    settings: Settings,
    current_user: User | None,
    anonymous_token: str | None,
    start_date: date,
    end_date: date,
    max_range_days: int,
) -> dict:
    validate_meal_range(start_date, end_date, max_days=max_range_days)
    reference_date = _kst_today()
    viewer_key = _viewer_rating_key(
        settings,
        current_user=current_user,
        anonymous_token=anonymous_token,
    )

    try:
        result = await session.execute(
            select(SchoolMeal).where(
                SchoolMeal.meal_date >= start_date,
                SchoolMeal.meal_date <= end_date,
                SchoolMeal.meal_type_code == LUNCH_MEAL_TYPE_CODE,
            ).order_by(SchoolMeal.meal_date.asc())
        )
        rows = list(result.scalars().all())
    except SQLAlchemyError as exc:
        raise SchoolMealError('급식 데이터를 읽지 못했습니다.', 500) from exc
    rows_by_date = {row.meal_date: row for row in rows}
    ratings_by_date = await get_meal_ratings_payload(
        session,
        start_date=start_date,
        end_date=end_date,
        viewer_key=viewer_key,
    )

    items = []
    for current_date in _date_range(start_date, end_date):
        row = rows_by_date.get(current_date)
        if row is None:
            item = _build_empty_entry(current_date, reference_date)
        else:
            item = _serialize_meal_entry(row, reference_date)
        item['ratings'] = ratings_by_date.get(current_date, _empty_ratings())
        items.append(item)

    return {
        'items': items,
        'meta': {
            'from': start_date.isoformat(),
            'to': end_date.isoformat(),
            'generatedAt': _iso_utc(_utc_now_naive()),
            'timezone': 'Asia/Seoul',
            'service': LUNCH_SERVICE,
            'maxRangeDays': max_range_days,
        },
    }


async def submit_meal_rating(
    session: AsyncSession,
    *,
    settings: Settings,
    target_date: date,
    category: str,
    score: int,
    current_user: User | None,
    anonymous_token: str | None,
) -> dict:
    if category not in MEAL_RATING_CATEGORIES:
        raise SchoolMealError('지원하지 않는 급식 평점 항목입니다.', 422)

    today = _kst_today()
    if target_date < today:
        raise SchoolMealError('지난 급식은 더 이상 입력할 수 없습니다.', 422)
    if category == 'taste' and target_date != today:
        raise SchoolMealError('이 급식 어때요는 급식 당일에만 입력할 수 있습니다.', 422)

    meal = await get_school_meal_for_date(session, target_date=target_date)
    if meal is None:
        raise SchoolMealError('운영되는 급식이 없는 날짜에는 평점을 남길 수 없습니다.', 404)

    viewer_key = _viewer_rating_key(
        settings,
        current_user=current_user,
        anonymous_token=anonymous_token,
    )

    try:
        existing_result = await session.execute(
            select(SchoolMealRating).where(
                SchoolMealRating.meal_date == target_date,
                SchoolMealRating.category == category,
                SchoolMealRating.voter_key == viewer_key,
            )
        )
        rating = existing_result.scalar_one_or_none()

        if rating is None:
            rating = SchoolMealRating(
                meal_date=target_date,
                category=category,
                score=score,
                voter_key=viewer_key,
                user_id=(int(current_user.id) if current_user is not None else None),
            )
            session.add(rating)
        else:
            rating.score = score
            rating.user_id = int(current_user.id) if current_user is not None else None

        await session.commit()
    except SQLAlchemyError as exc:
        await session.rollback()
        raise SchoolMealError('급식 평점을 저장하지 못했습니다.', 500) from exc

    ratings_by_date = await get_meal_ratings_payload(
        session,
        start_date=target_date,
        end_date=target_date,
        viewer_key=viewer_key,
    )
    return {
        'date': target_date.isoformat(),
        'ratings': ratings_by_date.get(target_date, _empty_ratings()),
    }
