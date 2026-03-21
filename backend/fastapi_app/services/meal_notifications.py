"""
Meal reminder subscriptions and Firebase web push delivery.
"""
from __future__ import annotations

import asyncio
import json
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from functools import partial
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import Settings
from ..models import SchoolMeal, SchoolMealNotificationSubscription, User
from .meals import SchoolMealError


DEFAULT_NOTIFICATION_MINUTE_OF_DAY = 7 * 60 + 30
NOTIFICATION_INTERVAL_MINUTES = 5
TIMEZONE_FALLBACKS = {
    'Asia/Seoul': timezone(timedelta(hours=9), name='Asia/Seoul'),
    'UTC': timezone.utc,
}

_FIREBASE_APP = None


@dataclass(slots=True)
class DueMealNotificationSubscription:
    subscription: SchoolMealNotificationSubscription
    local_date: date


def _utc_now_naive() -> datetime:
    return datetime.utcnow()


def _iso_utc(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    else:
        value = value.astimezone(timezone.utc)
    return value.isoformat().replace('+00:00', 'Z')


def _notification_time_to_minute_of_day(value: str) -> int:
    try:
        hour, minute = value.split(':', 1)
        minute_of_day = (int(hour) * 60) + int(minute)
    except (AttributeError, TypeError, ValueError) as exc:
        raise SchoolMealError('Meal notification time must be HH:MM.', 422) from exc

    if minute_of_day % NOTIFICATION_INTERVAL_MINUTES != 0:
        raise SchoolMealError('Meal notification time must use 5-minute increments.', 422)

    return minute_of_day


def _align_notification_minute_of_day(value: int | None) -> int:
    try:
        normalized = int(value if value is not None else DEFAULT_NOTIFICATION_MINUTE_OF_DAY)
    except (TypeError, ValueError):
        normalized = DEFAULT_NOTIFICATION_MINUTE_OF_DAY

    normalized = max(0, min(1439, normalized))
    return normalized - (normalized % NOTIFICATION_INTERVAL_MINUTES)


def _minute_of_day_to_notification_time(value: int) -> str:
    normalized = _align_notification_minute_of_day(value)
    return f'{normalized // 60:02d}:{normalized % 60:02d}'


def _serialize_subscription_item(
    *,
    installation_id: str,
    enabled: bool,
    notification_minute_of_day: int,
    timezone_name: str,
    fcm_token: str | None,
    last_sent_meal_date: date | None,
    updated_at: datetime | None,
) -> dict[str, Any]:
    return {
        'installationId': installation_id,
        'enabled': bool(enabled),
        'notificationTime': _minute_of_day_to_notification_time(notification_minute_of_day),
        'timezone': timezone_name or 'Asia/Seoul',
        'hasToken': bool(fcm_token),
        'lastSentMealDate': last_sent_meal_date.isoformat() if last_sent_meal_date else None,
        'updatedAt': _iso_utc(updated_at),
    }


def _build_default_subscription_item(installation_id: str) -> dict[str, Any]:
    return _serialize_subscription_item(
        installation_id=installation_id,
        enabled=False,
        notification_minute_of_day=DEFAULT_NOTIFICATION_MINUTE_OF_DAY,
        timezone_name='Asia/Seoul',
        fcm_token=None,
        last_sent_meal_date=None,
        updated_at=None,
    )


def _normalize_web_origin(settings: Settings) -> str:
    origin = str(settings.WEB_APP_ORIGIN or '').strip().rstrip('/')
    if not origin:
        raise SchoolMealError('WEB_APP_ORIGIN setting is required for meal notifications.', 500)
    return origin


def _resolve_timezone(timezone_name: str):
    normalized = str(timezone_name or 'Asia/Seoul').strip() or 'Asia/Seoul'
    try:
        return ZoneInfo(normalized)
    except ZoneInfoNotFoundError:
        fallback = TIMEZONE_FALLBACKS.get(normalized)
        if fallback is not None:
            return fallback
        raise SchoolMealError('Unsupported notification timezone.', 422)


def _get_current_local_date_and_minute(timezone_name: str, now: datetime | None = None) -> tuple[date, int]:
    base_now = now or datetime.now(timezone.utc)
    if base_now.tzinfo is None:
        base_now = base_now.replace(tzinfo=timezone.utc)
    local_now = base_now.astimezone(_resolve_timezone(timezone_name))
    return local_now.date(), (local_now.hour * 60) + local_now.minute


def _normalize_notification_menu_items(menu_items: list[str]) -> list[str]:
    normalized_items: list[str] = []
    for item in menu_items:
        normalized = str(item or '').strip()
        if normalized:
            normalized_items.append(normalized)
    return normalized_items


def _build_menu_items_notification_body(menu_items: list[str]) -> str:
    return '\n'.join(_normalize_notification_menu_items(menu_items))


def _get_firebase_app(settings: Settings):
    global _FIREBASE_APP
    if _FIREBASE_APP is not None:
        return _FIREBASE_APP

    raw_service_account_path = str(settings.FIREBASE_SERVICE_ACCOUNT_PATH or '').strip()
    if not raw_service_account_path:
        raise SchoolMealError('FIREBASE_SERVICE_ACCOUNT_PATH setting is required.', 500)
    service_account_path = Path(raw_service_account_path)
    if not service_account_path.exists():
        raise SchoolMealError('Firebase service account file was not found.', 500)

    try:
        import firebase_admin
        from firebase_admin import credentials
    except ImportError as exc:
        raise SchoolMealError('firebase-admin is not installed for FastAPI meal notifications.', 500) from exc

    _FIREBASE_APP = firebase_admin.initialize_app(
        credentials.Certificate(str(service_account_path)),
    )
    return _FIREBASE_APP


def _get_firebase_messaging_module(settings: Settings):
    app = _get_firebase_app(settings)
    try:
        from firebase_admin import messaging
    except ImportError as exc:
        raise SchoolMealError('firebase-admin messaging module is unavailable.', 500) from exc
    return messaging, app


def _is_invalid_registration_token_error(exc: Exception) -> bool:
    class_name = exc.__class__.__name__.lower()
    code = str(getattr(exc, 'code', '') or '').lower()
    message = str(exc).lower()

    if class_name in {'unregisterederror', 'senderidmismatcherror'}:
        return True
    if code in {'unregistered', 'registration-token-not-registered'}:
        return True
    if 'registration token' in message and (
        'not registered' in message
        or 'not a valid' in message
        or 'is invalid' in message
        or 'invalid registration' in message
    ):
        return True
    if code == 'invalid-argument' and 'registration token' in message:
        return True
    return False


async def get_subscription(
    session: AsyncSession,
    *,
    installation_id: str,
) -> dict[str, Any]:
    try:
        result = await session.execute(
            select(SchoolMealNotificationSubscription).where(
                SchoolMealNotificationSubscription.installation_id == installation_id
            )
        )
    except SQLAlchemyError as exc:
        raise SchoolMealError('Meal notification subscription could not be loaded.', 500) from exc

    row = result.scalar_one_or_none()
    if row is None:
        return _build_default_subscription_item(installation_id)

    return _serialize_subscription_item(
        installation_id=row.installation_id,
        enabled=bool(row.is_enabled),
        notification_minute_of_day=int(row.notification_minute_of_day or DEFAULT_NOTIFICATION_MINUTE_OF_DAY),
        timezone_name=row.timezone or 'Asia/Seoul',
        fcm_token=row.fcm_token,
        last_sent_meal_date=row.last_sent_meal_date,
        updated_at=row.updated_at,
    )


async def upsert_subscription(
    session: AsyncSession,
    *,
    installation_id: str,
    enabled: bool,
    notification_time: str,
    timezone_name: str,
    fcm_token: str | None,
    current_user: User | None,
) -> dict[str, Any]:
    minute_of_day = _notification_time_to_minute_of_day(notification_time)
    normalized_token = (fcm_token or '').strip() or None

    try:
        existing_result = await session.execute(
            select(SchoolMealNotificationSubscription).where(
                SchoolMealNotificationSubscription.installation_id == installation_id
            )
        )
        row = existing_result.scalar_one_or_none()

        if normalized_token:
            token_owner_result = await session.execute(
                select(SchoolMealNotificationSubscription).where(
                    SchoolMealNotificationSubscription.fcm_token == normalized_token,
                    SchoolMealNotificationSubscription.installation_id != installation_id,
                )
            )
            token_owner = token_owner_result.scalar_one_or_none()
            if token_owner is not None:
                token_owner.fcm_token = None
                token_owner.is_enabled = 0

        if row is None:
            row = SchoolMealNotificationSubscription(
                installation_id=installation_id,
                fcm_token=normalized_token,
                user_id=(int(current_user.id) if current_user is not None else None),
                timezone=timezone_name,
                notification_minute_of_day=minute_of_day,
                is_enabled=1 if enabled else 0,
            )
            session.add(row)
        else:
            row.timezone = timezone_name
            row.notification_minute_of_day = minute_of_day
            row.is_enabled = 1 if enabled else 0
            if normalized_token:
                row.fcm_token = normalized_token
            if current_user is not None:
                row.user_id = int(current_user.id)

        await session.commit()
        await session.refresh(row)
    except SQLAlchemyError as exc:
        await session.rollback()
        raise SchoolMealError('Meal notification subscription could not be saved.', 500) from exc

    return _serialize_subscription_item(
        installation_id=row.installation_id,
        enabled=bool(row.is_enabled),
        notification_minute_of_day=int(row.notification_minute_of_day or DEFAULT_NOTIFICATION_MINUTE_OF_DAY),
        timezone_name=row.timezone or 'Asia/Seoul',
        fcm_token=row.fcm_token,
        last_sent_meal_date=row.last_sent_meal_date,
        updated_at=row.updated_at,
    )


async def delete_subscription(
    session: AsyncSession,
    *,
    installation_id: str,
) -> None:
    try:
        result = await session.execute(
            select(SchoolMealNotificationSubscription).where(
                SchoolMealNotificationSubscription.installation_id == installation_id
            )
        )
        row = result.scalar_one_or_none()
        if row is not None:
            await session.delete(row)
        await session.commit()
    except SQLAlchemyError as exc:
        await session.rollback()
        raise SchoolMealError('Meal notification subscription could not be deleted.', 500) from exc


async def find_due_subscriptions(
    session: AsyncSession,
    *,
    now: datetime | None = None,
) -> list[DueMealNotificationSubscription]:
    try:
        result = await session.execute(
            select(SchoolMealNotificationSubscription).where(
                SchoolMealNotificationSubscription.is_enabled == 1,
                SchoolMealNotificationSubscription.fcm_token.is_not(None),
            )
        )
        rows = list(result.scalars().all())
    except SQLAlchemyError as exc:
        raise SchoolMealError('Meal notification subscriptions could not be loaded.', 500) from exc

    due_rows: list[DueMealNotificationSubscription] = []
    for row in rows:
        timezone_name = row.timezone or 'Asia/Seoul'
        local_date, local_minute = _get_current_local_date_and_minute(timezone_name, now=now)
        scheduled_minute = _align_notification_minute_of_day(row.notification_minute_of_day)
        if scheduled_minute != local_minute:
            continue
        if row.last_sent_meal_date == local_date:
            continue
        due_rows.append(DueMealNotificationSubscription(subscription=row, local_date=local_date))

    return due_rows


async def build_meal_notification_payload(
    session: AsyncSession,
    *,
    settings: Settings,
    target_date: date,
) -> dict[str, str] | None:
    try:
        result = await session.execute(
            select(SchoolMeal).where(
                SchoolMeal.meal_date == target_date,
                SchoolMeal.meal_type_code == '2',
            )
        )
    except SQLAlchemyError as exc:
        raise SchoolMealError('Meal notification payload could not load meal data.', 500) from exc

    meal = result.scalar_one_or_none()
    if meal is None:
        return None

    menu_items = meal.menu_items()[:3]
    body = ', '.join(menu_items).strip() or meal.preview_text or '오늘 급식을 확인해 보세요.'
    if len(body) > 120:
        body = f'{body[:117].rstrip()}...'

    origin = _normalize_web_origin(settings)
    month_key = target_date.strftime('%Y-%m')
    date_key = target_date.isoformat()
    return {
        'title': '오늘의 급식',
        'body': body,
        'link': f'{origin}/school-info/meal?tab=today&date={date_key}&month={month_key}',
        'icon': f'{origin}/pwa-192x192.png',
        'mealDate': date_key,
    }


async def build_multiline_meal_notification_payload(
    session: AsyncSession,
    *,
    settings: Settings,
    target_date: date,
) -> dict[str, str] | None:
    payload = await build_meal_notification_payload(
        session,
        settings=settings,
        target_date=target_date,
    )
    if payload is None:
        return None

    try:
        result = await session.execute(
            select(SchoolMeal).where(
                SchoolMeal.meal_date == target_date,
                SchoolMeal.meal_type_code == '2',
            )
        )
    except SQLAlchemyError as exc:
        raise SchoolMealError('Meal notification payload could not load meal data.', 500) from exc
    meal = result.scalar_one_or_none()
    if meal is None:
        return None

    menu_items = _normalize_notification_menu_items(meal.menu_items())
    payload['body'] = _build_menu_items_notification_body(menu_items) or payload['body']
    payload['menuItemsJson'] = json.dumps(menu_items, ensure_ascii=False)
    return payload


async def _send_multicast_message(settings: Settings, *, tokens: list[str], payload: dict[str, str], dry_run: bool):
    messaging, app = _get_firebase_messaging_module(settings)
    multicast_message = messaging.MulticastMessage(
        tokens=tokens,
        notification=messaging.Notification(
            title=payload['title'],
            body=payload['body'],
        ),
        data={
            'link': payload['link'],
            'mealDate': payload['mealDate'],
            'menuItemsJson': payload.get('menuItemsJson', '[]'),
            'title': payload['title'],
            'body': payload['body'],
        },
        webpush=messaging.WebpushConfig(
            fcm_options=messaging.WebpushFCMOptions(link=payload['link']),
            notification=messaging.WebpushNotification(
                title=payload['title'],
                body=payload['body'],
                icon=payload['icon'],
                badge=payload['icon'],
                tag=f"school-meal-{payload['mealDate']}",
            ),
        ),
    )

    sender = partial(
        messaging.send_each_for_multicast,
        multicast_message,
        dry_run=dry_run,
        app=app,
    )
    return await asyncio.to_thread(sender)


async def send_due_notifications(
    session: AsyncSession,
    *,
    settings: Settings,
    now: datetime | None = None,
    dry_run: bool = False,
) -> dict[str, Any]:
    due_rows = await find_due_subscriptions(session, now=now)
    if not due_rows:
        return {
            'processedAt': _iso_utc(_utc_now_naive()),
            'dryRun': dry_run,
            'dueCount': 0,
            'sentCount': 0,
            'failureCount': 0,
            'invalidatedCount': 0,
            'skippedNoMealCount': 0,
        }

    grouped_rows: dict[date, list[DueMealNotificationSubscription]] = defaultdict(list)
    for item in due_rows:
        grouped_rows[item.local_date].append(item)

    sent_count = 0
    failure_count = 0
    invalidated_count = 0
    skipped_no_meal_count = 0

    for target_date, items in grouped_rows.items():
        payload = await build_multiline_meal_notification_payload(
            session,
            settings=settings,
            target_date=target_date,
        )
        if payload is None:
            skipped_no_meal_count += len(items)
            continue

        valid_items = [item for item in items if item.subscription.fcm_token]
        for start in range(0, len(valid_items), 500):
            chunk = valid_items[start:start + 500]
            tokens = [item.subscription.fcm_token for item in chunk if item.subscription.fcm_token]
            batch_response = await _send_multicast_message(
                settings,
                tokens=tokens,
                payload=payload,
                dry_run=dry_run,
            )
            for item, response in zip(chunk, batch_response.responses):
                if response.success:
                    sent_count += 1
                    if not dry_run:
                        item.subscription.last_sent_meal_date = item.local_date
                    continue

                failure_count += 1
                exception = response.exception
                if exception is not None and _is_invalid_registration_token_error(exception):
                    invalidated_count += 1
                    if not dry_run:
                        item.subscription.fcm_token = None
                        item.subscription.is_enabled = 0

    if not dry_run:
        try:
            await session.commit()
        except SQLAlchemyError as exc:
            await session.rollback()
            raise SchoolMealError('Meal notification delivery state could not be saved.', 500) from exc

    return {
        'processedAt': _iso_utc(_utc_now_naive()),
        'dryRun': dry_run,
        'dueCount': len(due_rows),
        'sentCount': sent_count,
        'failureCount': failure_count,
        'invalidatedCount': invalidated_count,
        'skippedNoMealCount': skipped_no_meal_count,
    }
