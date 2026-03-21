"""
FastAPI router for school-meal read, rating, and notification-subscription APIs.
"""
from __future__ import annotations

import secrets
from datetime import date

from fastapi import APIRouter, Query, Request, Response

from ..deps import DbSession, OptionalCurrentUser, SettingsDep
from ..schemas import (
    MealRangeQuery,
    MealRangeResponse,
    MealNotificationSubscriptionResponse,
    MealNotificationSubscriptionUpsertRequest,
    MealRatingSubmitRequest,
    MealRatingSubmitResponse,
    MealTodayResponse,
)
from ..services.meal_notifications import (
    delete_subscription,
    get_subscription,
    upsert_subscription,
)
from ..services.meals import (
    get_meal_range_payload,
    get_today_meal_payload,
    submit_meal_rating,
)


router = APIRouter(prefix='/api/school-info/meals', tags=['school-meals'])


def _ensure_meal_rating_cookie(
    request: Request,
    response: Response,
    settings: SettingsDep,
) -> str:
    """Ensure every browser has a stable anonymous rating token before meal reads or writes."""
    token = request.cookies.get(settings.MEAL_RATING_COOKIE_NAME) or secrets.token_urlsafe(24)
    response.set_cookie(
        settings.MEAL_RATING_COOKIE_NAME,
        token,
        httponly=True,
        secure=settings.JWT_COOKIE_SECURE,
        samesite=str(settings.JWT_COOKIE_SAMESITE).lower(),
        domain=settings.JWT_COOKIE_DOMAIN,
        path=settings.MEAL_RATING_COOKIE_PATH,
        max_age=settings.MEAL_RATING_COOKIE_MAX_AGE_SECONDS,
    )
    return token


@router.get('/today', response_model=MealTodayResponse)
async def get_today_school_meal(
    request: Request,
    response: Response,
    db: DbSession,
    settings: SettingsDep,
    current_user: OptionalCurrentUser,
):
    # Reads and writes share the same anonymous token contract so signed-out users can still keep one rating per meal.
    anonymous_token = _ensure_meal_rating_cookie(request, response, settings)
    return await get_today_meal_payload(
        db,
        settings=settings,
        current_user=current_user,
        anonymous_token=anonymous_token,
    )


@router.get('', response_model=MealRangeResponse)
async def get_school_meal_range(
    request: Request,
    response: Response,
    db: DbSession,
    settings: SettingsDep,
    current_user: OptionalCurrentUser,
    from_date: date = Query(alias='from'),
    to_date: date = Query(alias='to'),
):
    # Range reads also mint the anonymous cookie because ratings are rendered together with the meal payload.
    anonymous_token = _ensure_meal_rating_cookie(request, response, settings)
    query = MealRangeQuery.model_validate({
        'from': from_date.isoformat(),
        'to': to_date.isoformat(),
    })
    return await get_meal_range_payload(
        db,
        settings=settings,
        current_user=current_user,
        anonymous_token=anonymous_token,
        start_date=query.from_date,
        end_date=query.to_date,
        max_range_days=settings.MEALS_MAX_RANGE_DAYS,
    )


@router.post('/{meal_date}/ratings', response_model=MealRatingSubmitResponse)
async def post_school_meal_rating(
    meal_date: date,
    body: MealRatingSubmitRequest,
    request: Request,
    response: Response,
    db: DbSession,
    settings: SettingsDep,
    current_user: OptionalCurrentUser,
):
    # Rating submission uses the same cookie-based anonymous identity as the read endpoints.
    anonymous_token = _ensure_meal_rating_cookie(request, response, settings)
    return await submit_meal_rating(
        db,
        settings=settings,
        target_date=meal_date,
        category=body.category,
        score=body.score,
        current_user=current_user,
        anonymous_token=anonymous_token,
    )


@router.get('/notifications/subscription', response_model=MealNotificationSubscriptionResponse)
async def get_meal_notification_subscription(
    db: DbSession,
    installation_id: str = Query(alias='installationId', min_length=1, max_length=64),
):
    # Subscriptions are device-scoped, so lookup is keyed by installationId instead of user session state.
    return {
        'item': await get_subscription(
            db,
            installation_id=installation_id,
        )
    }


@router.put('/notifications/subscription', response_model=MealNotificationSubscriptionResponse)
async def put_meal_notification_subscription(
    body: MealNotificationSubscriptionUpsertRequest,
    db: DbSession,
    current_user: OptionalCurrentUser,
):
    # Updating the subscription upserts one row per installed device/PWA instance.
    return {
        'item': await upsert_subscription(
            db,
            installation_id=body.installationId,
            enabled=body.enabled,
            notification_time=body.notificationTime,
            timezone_name=body.timezone,
            fcm_token=body.fcmToken,
            current_user=current_user,
        )
    }


@router.delete('/notifications/subscription', status_code=204)
async def delete_meal_notification_subscription(
    db: DbSession,
    installation_id: str = Query(alias='installationId', min_length=1, max_length=64),
):
    # Deleting the row fully disables reminders for that installed device.
    await delete_subscription(
        db,
        installation_id=installation_id,
    )
