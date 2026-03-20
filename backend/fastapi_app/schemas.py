"""
Pydantic V2 request/response schemas for sports league endpoints.
"""
from __future__ import annotations

from datetime import date
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class ScoreSnapshot(BaseModel):
    teamA: int = Field(default=0, ge=0)
    teamB: int = Field(default=0, ge=0)


class CreateEventRequest(BaseModel):
    matchId: str
    eventType: str | None = None
    status: str | None = None
    minute: int | None = None
    message: str | None = None
    scoreSnapshot: ScoreSnapshot | None = None
    subjectTeamId: str | None = None
    winnerTeamId: str | None = None


class UpdateEventRequest(BaseModel):
    eventType: str | None = None
    status: str | None = None
    minute: int | None = None
    message: str | None = None
    scoreSnapshot: ScoreSnapshot | None = None
    subjectTeamId: str | None = None
    winnerTeamId: str | None = None


class StandingsOverrideRow(BaseModel):
    teamId: str
    rank: int = Field(ge=1)
    points: int = Field(default=0, ge=0)
    goalDifference: int = 0
    goalsFor: int = Field(default=0, ge=0)
    goalsAgainst: int = Field(default=0, ge=0)
    wins: int = Field(default=0, ge=0)
    draws: int = Field(default=0, ge=0)
    losses: int = Field(default=0, ge=0)
    note: str = ''


class StandingsOverrideRequest(BaseModel):
    rows: list[StandingsOverrideRow]


class MatchParticipantsRequest(BaseModel):
    teamAId: str
    teamBId: str


class CreatePlayerRequest(BaseModel):
    # The backend trims and sanitizes the final value, but schema bounds still reject obviously invalid input.
    name: str = Field(min_length=1, max_length=20)


class AdjustPlayerStatRequest(BaseModel):
    # Only scoreboard-facing counters are patchable through the public manager UI.
    stat: Literal['goals', 'assists']
    # Delta is intentionally step-based so the UI can offer simple +/- controls without sending absolute totals.
    delta: Literal[-1, 1]


class MealRatingBucketResponse(BaseModel):
    score: Literal[1, 2, 3, 4, 5]
    count: int = Field(default=0, ge=0)
    ratio: int = Field(default=0, ge=0, le=100)


class MealRatingSummaryResponse(BaseModel):
    averageScore: float | None = None
    totalCount: int = Field(default=0, ge=0)
    myScore: int | None = Field(default=None, ge=1, le=5)
    distribution: list[MealRatingBucketResponse] = Field(default_factory=list)


class MealRatingsResponse(BaseModel):
    taste: MealRatingSummaryResponse = Field(default_factory=MealRatingSummaryResponse)
    anticipation: MealRatingSummaryResponse = Field(default_factory=MealRatingSummaryResponse)


class MealEntryResponse(BaseModel):
    id: str
    date: str
    status: Literal['today', 'past', 'upcoming', 'empty']
    service: Literal['lunch'] = 'lunch'
    serviceLabel: str = '중식'
    menuItems: list[str]
    previewText: str
    note: str
    isNoMeal: bool
    calorieText: str | None = None
    caloriesKcal: float | None = None
    originItems: list[str]
    nutritionItems: list[str]
    ratings: MealRatingsResponse = Field(default_factory=MealRatingsResponse)
    syncedAt: str | None = None


class MealTodayMetaResponse(BaseModel):
    date: str
    generatedAt: str
    timezone: str


class MealRangeMetaResponse(BaseModel):
    from_: str = Field(alias='from')
    to: str
    generatedAt: str
    timezone: str
    service: Literal['lunch'] = 'lunch'
    maxRangeDays: int

    model_config = ConfigDict(populate_by_name=True)


class MealTodayResponse(BaseModel):
    item: MealEntryResponse
    meta: MealTodayMetaResponse


class MealRangeResponse(BaseModel):
    items: list[MealEntryResponse]
    meta: MealRangeMetaResponse


class MealRangeQuery(BaseModel):
    from_date: date = Field(alias='from')
    to_date: date = Field(alias='to')

    model_config = ConfigDict(populate_by_name=True)


class MealRatingSubmitRequest(BaseModel):
    category: Literal['taste', 'anticipation']
    score: int = Field(ge=1, le=5)


class MealRatingSubmitResponse(BaseModel):
    date: str
    ratings: MealRatingsResponse


TIMEZONE_FALLBACK_ALLOWLIST = {'Asia/Seoul', 'UTC'}
MEAL_NOTIFICATION_INTERVAL_MINUTES = 5


class MealNotificationSubscriptionItemResponse(BaseModel):
    installationId: str
    enabled: bool
    notificationTime: str
    timezone: str = 'Asia/Seoul'
    hasToken: bool = False
    lastSentMealDate: str | None = None
    updatedAt: str | None = None


class MealNotificationSubscriptionResponse(BaseModel):
    item: MealNotificationSubscriptionItemResponse


class MealNotificationSubscriptionUpsertRequest(BaseModel):
    installationId: str = Field(min_length=1, max_length=64)
    enabled: bool = False
    notificationTime: str = Field(default='07:30', min_length=5, max_length=5)
    timezone: str = Field(default='Asia/Seoul', min_length=1, max_length=64)
    fcmToken: str | None = Field(default=None, min_length=1, max_length=512)

    @field_validator('notificationTime')
    @classmethod
    def validate_notification_time(cls, value: str) -> str:
        parts = value.split(':')
        if len(parts) != 2 or any(not part.isdigit() for part in parts):
            raise ValueError('notificationTime must be HH:MM')
        hour, minute = (int(part) for part in parts)
        if hour < 0 or hour > 23 or minute < 0 or minute > 59:
            raise ValueError('notificationTime must be HH:MM')
        if minute % MEAL_NOTIFICATION_INTERVAL_MINUTES != 0:
            raise ValueError('notificationTime must use 5-minute increments')
        return f'{hour:02d}:{minute:02d}'

    @field_validator('timezone')
    @classmethod
    def validate_timezone(cls, value: str) -> str:
        normalized = value.strip()
        if normalized in TIMEZONE_FALLBACK_ALLOWLIST:
            return normalized
        try:
            ZoneInfo(normalized)
        except ZoneInfoNotFoundError as exc:
            raise ValueError('timezone must be a valid IANA timezone') from exc
        return normalized

    @model_validator(mode='after')
    def validate_enabled_token_contract(self) -> 'MealNotificationSubscriptionUpsertRequest':
        if self.enabled and not self.fcmToken:
            raise ValueError('fcmToken is required when enabled is true')
        return self


class FieldTripUnlockRequest(BaseModel):
    password: str = Field(min_length=1, max_length=64)


class FieldTripAttachmentInput(BaseModel):
    id: str = Field(min_length=1, max_length=120)
    url: str = Field(min_length=1, max_length=1024)
    canonicalUrl: str | None = Field(default=None, max_length=1024)
    name: str = Field(min_length=1, max_length=255)
    size: int = Field(default=0, ge=0)
    mime: str = Field(min_length=1, max_length=120)
    kind: Literal['image', 'file']


class FieldTripCreatePostRequest(BaseModel):
    # Nickname becomes optional because unlocked anonymous visitors can write
    # with a supplied nickname while authenticated users inherit their profile nickname.
    nickname: str | None = Field(default=None, max_length=20)
    title: str = Field(min_length=1, max_length=80)
    body: str = Field(min_length=1, max_length=6000)
    attachments: list[FieldTripAttachmentInput] = Field(default_factory=list, max_length=5)


class FieldTripUpdatePostRequest(FieldTripCreatePostRequest):
    pass


class FieldTripScoreRowUpdate(BaseModel):
    classId: str = Field(min_length=1, max_length=2)
    totalScore: int = Field(ge=0, le=10000)


class FieldTripScoreboardUpdateRequest(BaseModel):
    rows: list[FieldTripScoreRowUpdate] = Field(min_length=1, max_length=10)


class FieldTripScoreDeltaRequest(BaseModel):
    # The API only accepts the same +/-5 step exposed by the manager controls.
    delta: Literal[-5, 5]


class FieldTripPasswordUpdateRequest(BaseModel):
    password: str = Field(min_length=4, max_length=64)


class FieldTripBoardDescriptionUpdateRequest(BaseModel):
    boardDescription: str = Field(default='', max_length=240)
