"""
FastAPI router for school-meal read, rating, and notification-subscription APIs.
"""
from __future__ import annotations

import secrets
from datetime import date

from fastapi import APIRouter, Depends, Query, Request, Response

from ..deps import CurrentUser, DbSession, OptionalCurrentUser, SettingsDep, get_client_ip, require_role
from ..schemas import (
    MealCommentApprovalRequest,
    MealCommentCreateRequest,
    MealCommentResponse,
    MealCommentsResponse,
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
    create_meal_comment,
    get_meal_range_payload,
    get_today_meal_payload,
    list_meal_comments,
    set_meal_comment_approval,
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


@router.get('/{meal_date}/comments', response_model=MealCommentsResponse)
async def get_school_meal_comments(
    meal_date: date,
    db: DbSession,
    current_user: OptionalCurrentUser,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, alias='pageSize', ge=1, le=100),
    order: str = Query(default='asc', pattern='^(asc|desc)$'),
):
    # The service applies role-aware visibility so anonymous, author, and admin totals stay consistent.
    return await list_meal_comments(
        db,
        target_date=meal_date,
        current_user=current_user,
        page=page,
        page_size=page_size,
        order=order,
    )


@router.post('/{meal_date}/comments', response_model=MealCommentResponse, status_code=201)
async def post_school_meal_comment(
    meal_date: date,
    body: MealCommentCreateRequest,
    request: Request,
    db: DbSession,
    settings: SettingsDep,
    current_user: CurrentUser,
):
    # Request metadata is stored with the pending row for later moderation review.
    return await create_meal_comment(
        db,
        target_date=meal_date,
        body=body.body,
        current_user=current_user,
        ip_address=get_client_ip(request, settings),
        user_agent=request.headers.get('user-agent'),
    )


@router.patch('/{meal_date}/comments/{comment_id}/approval', response_model=MealCommentResponse)
async def patch_school_meal_comment_approval(
    meal_date: date,
    comment_id: int,
    body: MealCommentApprovalRequest,
    db: DbSession,
    current_user=Depends(require_role('admin')),
):
    # Approval is date-scoped to avoid toggling a comment attached to another meal.
    return await set_meal_comment_approval(
        db,
        target_date=meal_date,
        comment_id=comment_id,
        approved=body.approved,
        current_user=current_user,
    )


@router.get('/notifications/subscription', response_model=MealNotificationSubscriptionResponse)
async def get_meal_notification_subscription(
    db: DbSession,
    installation_id: str = Query(alias='installationId', min_length=1, max_length=64),
):
    # Subscriptions are device-scoped, so lookup is keyed by installationId instead
    # of user session state.
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
