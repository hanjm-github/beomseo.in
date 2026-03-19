"""
Pydantic V2 request/response schemas for sports league endpoints.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


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
