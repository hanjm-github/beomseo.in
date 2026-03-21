"""
FastAPI router for the field-trip board feature.

The board uses a two-step write gate: class unlock cookie first, then a
field-trip-specific CSRF header for forms and mutations.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, Request, Response, UploadFile
from fastapi.responses import FileResponse

from ..deps import (
    CurrentUser,
    DbSession,
    FieldTripUnlockedClasses,
    OptionalCurrentUser,
    SettingsDep,
    encode_field_trip_unlock_token,
    generate_field_trip_csrf_token,
    get_client_ip,
    require_any_field_trip_unlock,
    require_field_trip_class_unlocked,
    require_field_trip_write_csrf,
    require_role,
)
from ..schemas import (
    FieldTripBoardDescriptionUpdateRequest,
    FieldTripCreatePostRequest,
    FieldTripPasswordUpdateRequest,
    FieldTripScoreDeltaRequest,
    FieldTripScoreboardUpdateRequest,
    FieldTripUpdatePostRequest,
    FieldTripUnlockRequest,
)
from ..services.field_trip import (
    adjust_score,
    create_post,
    delete_post,
    get_post,
    get_scoreboard,
    get_upload_delivery,
    list_classes,
    list_posts,
    unlock_class,
    update_board_description,
    update_class_password,
    update_post,
    update_scoreboard,
    upload_file,
)


router = APIRouter(prefix='/api/community/field-trip', tags=['field-trip'])


def _set_field_trip_csrf_cookie(
    response: Response,
    settings: SettingsDep,
    csrf_token: str,
) -> None:
    """Refresh the field-trip CSRF cookie used by unlocked board forms."""
    response.set_cookie(
        settings.FIELD_TRIP_CSRF_COOKIE_NAME,
        csrf_token,
        httponly=False,
        secure=settings.JWT_COOKIE_SECURE,
        samesite=str(settings.JWT_COOKIE_SAMESITE).lower(),
        domain=settings.JWT_COOKIE_DOMAIN,
        path=settings.FIELD_TRIP_CSRF_COOKIE_PATH,
    )


@router.get('/classes')
async def get_field_trip_classes(
    db: DbSession,
    unlocked_class_ids: FieldTripUnlockedClasses,
):
    return await list_classes(db, unlocked_class_ids)


@router.post('/classes/{class_id}/unlock')
async def unlock_field_trip_class(
    class_id: str,
    body: FieldTripUnlockRequest,
    response: Response,
    db: DbSession,
    settings: SettingsDep,
    unlocked_class_ids: FieldTripUnlockedClasses,
):
    next_unlocked = await unlock_class(db, class_id, body.password, unlocked_class_ids)
    csrf_token = generate_field_trip_csrf_token()

    unlock_cookie_kwargs = {
        'secure': settings.JWT_COOKIE_SECURE,
        'samesite': str(settings.JWT_COOKIE_SAMESITE).lower(),
        'domain': settings.JWT_COOKIE_DOMAIN,
        'path': settings.FIELD_TRIP_COOKIE_PATH,
    }

    response.set_cookie(
        settings.FIELD_TRIP_UNLOCK_COOKIE_NAME,
        encode_field_trip_unlock_token(next_unlocked, settings),
        httponly=True,
        **unlock_cookie_kwargs,
    )
    _set_field_trip_csrf_cookie(response, settings, csrf_token)
    return {'classId': str(class_id), 'isUnlocked': True}


@router.get('/classes/{class_id}/posts')
async def get_field_trip_posts(
    class_id: str,
    request: Request,
    response: Response,
    db: DbSession,
    settings: SettingsDep,
    unlocked_classes: set[str] = Depends(require_field_trip_class_unlocked),
):
    # Read responses re-issue the field-trip CSRF cookie so unlocked visitors can submit forms without a reload.
    _set_field_trip_csrf_cookie(
        response,
        settings,
        request.cookies.get(settings.FIELD_TRIP_CSRF_COOKIE_NAME) or generate_field_trip_csrf_token(),
    )
    return await list_posts(db, settings, class_id)


@router.get('/classes/{class_id}/posts/{post_id}')
async def get_field_trip_post_detail(
    class_id: str,
    post_id: str,
    request: Request,
    response: Response,
    db: DbSession,
    settings: SettingsDep,
    unlocked_classes: set[str] = Depends(require_field_trip_class_unlocked),
):
    # Detail reads use the same CSRF refresh path as list reads because the compose/edit UI can open from here too.
    _set_field_trip_csrf_cookie(
        response,
        settings,
        request.cookies.get(settings.FIELD_TRIP_CSRF_COOKIE_NAME) or generate_field_trip_csrf_token(),
    )
    return await get_post(db, settings, class_id, post_id)


@router.post('/classes/{class_id}/posts', status_code=201)
async def create_field_trip_post(
    class_id: str,
    body: FieldTripCreatePostRequest,
    request: Request,
    db: DbSession,
    settings: SettingsDep,
    current_user: OptionalCurrentUser,
    unlocked_classes: set[str] = Depends(require_field_trip_class_unlocked),
    _: None = Depends(require_field_trip_write_csrf),
):
    # Anonymous creation is allowed after the class board has been unlocked, so the service resolves the
    # final author identity from either the JWT user or the nickname supplied in the request body.
    client_ip = get_client_ip(request, settings)
    user_agent = request.headers.get('user-agent', '')
    return await create_post(
        db,
        settings,
        class_id,
        body.model_dump(),
        client_ip,
        user_agent,
        current_user,
    )


@router.put('/classes/{class_id}/posts/{post_id}')
async def put_field_trip_post(
    class_id: str,
    post_id: str,
    body: FieldTripUpdatePostRequest,
    request: Request,
    db: DbSession,
    settings: SettingsDep,
    current_user: CurrentUser,
    unlocked_classes: set[str] = Depends(require_field_trip_class_unlocked),
    _: None = Depends(require_field_trip_write_csrf),
):
    client_ip = get_client_ip(request, settings)
    user_agent = request.headers.get('user-agent', '')
    return await update_post(
        db,
        settings,
        class_id,
        post_id,
        body.model_dump(),
        client_ip,
        user_agent,
        current_user,
    )


@router.delete('/classes/{class_id}/posts/{post_id}')
async def delete_field_trip_post(
    class_id: str,
    post_id: str,
    db: DbSession,
    settings: SettingsDep,
    current_user: CurrentUser,
    unlocked_classes: set[str] = Depends(require_field_trip_class_unlocked),
    _: None = Depends(require_field_trip_write_csrf),
):
    return await delete_post(db, settings, class_id, post_id, current_user)


@router.post('/uploads', status_code=201)
async def upload_field_trip_file(
    settings: SettingsDep,
    file: UploadFile = File(...),
    unlocked_classes: set[str] = Depends(require_any_field_trip_unlock),
    _: None = Depends(require_field_trip_write_csrf),
):
    try:
        return await upload_file(settings, file)
    finally:
        await file.close()


@router.get('/uploads/{filename}')
async def serve_field_trip_upload(
    filename: str,
    request: Request,
    db: DbSession,
    settings: SettingsDep,
    unlocked_class_ids: FieldTripUnlockedClasses,
):
    delivery = await get_upload_delivery(
        db,
        settings,
        filename,
        request.query_params.get('preview_token', ''),
        unlocked_class_ids,
    )
    response = FileResponse(
        path=delivery['path'],
        media_type=delivery['mediaType'],
        filename=delivery['downloadName'],
        content_disposition_type=delivery['contentDisposition'],
    )
    response.headers.setdefault('X-Content-Type-Options', 'nosniff')
    return response


@router.get('/scoreboard')
async def get_field_trip_scoreboard(
    db: DbSession,
):
    return await get_scoreboard(db)


@router.put('/scoreboard')
async def put_field_trip_scoreboard(
    body: FieldTripScoreboardUpdateRequest,
    db: DbSession,
    current_user: object = Depends(require_role('student_council', 'admin')),
):
    return await update_scoreboard(
        db,
        [row.model_dump() for row in body.rows],
    )


@router.patch('/classes/{class_id}/score')
async def patch_field_trip_score(
    class_id: str,
    body: FieldTripScoreDeltaRequest,
    db: DbSession,
    _: object = Depends(require_role('student_council', 'admin')),
):
    return await adjust_score(db, class_id, body.delta)


@router.put('/classes/{class_id}/password')
async def put_field_trip_class_password(
    class_id: str,
    body: FieldTripPasswordUpdateRequest,
    db: DbSession,
    _: object = Depends(require_role('admin')),
):
    # Board credentials are restricted to admins so student-council users can manage scores
    # without being able to rotate every class password.
    return await update_class_password(db, class_id, body.password)


@router.put('/classes/{class_id}/board-description')
async def put_field_trip_board_description(
    class_id: str,
    body: FieldTripBoardDescriptionUpdateRequest,
    db: DbSession,
    _: object = Depends(require_role('admin')),
):
    # Description edits change the board-level contract shown to every visitor, so they follow
    # the same admin-only policy as password rotation.
    return await update_board_description(db, class_id, body.boardDescription)
