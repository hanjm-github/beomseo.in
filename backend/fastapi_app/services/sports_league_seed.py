"""
Seed data and event defaults for the sports league live text feature.

This is a direct copy of the Flask seed data module — it contains only
pure data constants and requires no framework-specific adaptation.
"""
from __future__ import annotations

SPORTS_LEAGUE_CATEGORY_ID = '2026-spring-grade3-boys-soccer'
SPORTS_LEAGUE_STORAGE_VERSION = '2026.03.15'

SPORTS_EVENT_TEMPLATES = (
    {'id': 'note', 'defaultStatus': None},
    {'id': 'kickoff', 'defaultStatus': 'kickoff'},
    {'id': 'goal', 'defaultStatus': 'live'},
    {'id': 'yellow', 'defaultStatus': 'live'},
    {'id': 'red', 'defaultStatus': 'live'},
    {'id': 'halftime', 'defaultStatus': 'halftime'},
    {'id': 'second_half', 'defaultStatus': 'live'},
    {'id': 'fulltime', 'defaultStatus': 'completed'},
)

SPORTS_EVENT_DEFAULT_STATUS = {
    item['id']: item['defaultStatus']
    for item in SPORTS_EVENT_TEMPLATES
}

SPORTS_LEAGUE_SEED = {
    'category': {
        'id': SPORTS_LEAGUE_CATEGORY_ID,
        'title': '2026 1학기 3학년 남자 축구',
        'subtitle': '스포츠리그 반대항전 문자중계',
        'seasonLabel': '2026 1학기',
        'gradeLabel': '3학년',
        'sportLabel': '남자 축구',
        'statusNote': '실시간 문자중계 등록은 학생회와 관리자만 가능합니다.',
        'scheduleWindowLabel': '2026.03.16 ~ 2026.04.08',
        'matchTimeLabel': '12:45 킥오프 · 전후반 각 20분 · 1분 휴식',
        'broadcastLabel': '실시간 SSE 문자중계',
        'locationLabel': '범서고등학교 스포츠리그',
    },
    'teams': [
        {'id': 'team-3-6', 'name': '3-6', 'shortName': '3-6', 'group': 'A', 'tone': 'groupA'},
        {'id': 'team-3-8', 'name': '3-8', 'shortName': '3-8', 'group': 'A', 'tone': 'groupA'},
        {'id': 'team-3-9', 'name': '3-9', 'shortName': '3-9', 'group': 'A', 'tone': 'groupA'},
        {'id': 'team-3-10', 'name': '3-10', 'shortName': '3-10', 'group': 'A', 'tone': 'groupA'},
        {
            'id': 'team-3-1-3-3',
            'name': '3-1·3-3',
            'shortName': '3-1·3-3',
            'group': 'B',
            'tone': 'groupB',
        },
        {
            'id': 'team-3-2-3-4',
            'name': '3-2·3-4',
            'shortName': '3-2·3-4',
            'group': 'B',
            'tone': 'groupB',
        },
        {
            'id': 'team-3-5-3-7',
            'name': '3-5·3-7',
            'shortName': '3-5·3-7',
            'group': 'B',
            'tone': 'groupB',
        },
        {
            'id': 'placeholder-a-1',
            'name': 'A조 1위',
            'shortName': 'A조 1위',
            'group': 'K',
            'tone': 'knockout',
        },
        {
            'id': 'placeholder-a-2',
            'name': 'A조 2위',
            'shortName': 'A조 2위',
            'group': 'K',
            'tone': 'knockout',
        },
        {
            'id': 'placeholder-b-1',
            'name': 'B조 1위',
            'shortName': 'B조 1위',
            'group': 'K',
            'tone': 'knockout',
        },
        {
            'id': 'placeholder-b-2',
            'name': 'B조 2위',
            'shortName': 'B조 2위',
            'group': 'K',
            'tone': 'knockout',
        },
        {
            'id': 'placeholder-semi-1-winner',
            'name': '준결승1 승리',
            'shortName': '준결승1 승리',
            'group': 'K',
            'tone': 'knockout',
        },
        {
            'id': 'placeholder-semi-2-winner',
            'name': '준결승2 승리',
            'shortName': '준결승2 승리',
            'group': 'K',
            'tone': 'knockout',
        },
    ],
    'matches': [
        {
            'id': 'match-a-1', 'phase': 'group', 'stageLabel': 'A조 1차전',
            'group': 'A', 'weekLabel': '1주차',
            'kickoffAt': '2026-03-16T12:45:00+09:00',
            'teamAId': 'team-3-6', 'teamBId': 'team-3-8',
            'status': 'upcoming', 'score': {'teamA': 0, 'teamB': 0},
        },
        {
            'id': 'match-a-2', 'phase': 'group', 'stageLabel': 'A조 2차전',
            'group': 'A', 'weekLabel': '1주차',
            'kickoffAt': '2026-03-18T12:45:00+09:00',
            'teamAId': 'team-3-9', 'teamBId': 'team-3-10',
            'status': 'upcoming', 'score': {'teamA': 0, 'teamB': 0},
        },
        {
            'id': 'match-b-1', 'phase': 'group', 'stageLabel': 'B조 1차전',
            'group': 'B', 'weekLabel': '1주차',
            'kickoffAt': '2026-03-19T12:45:00+09:00',
            'teamAId': 'team-3-1-3-3', 'teamBId': 'team-3-2-3-4',
            'status': 'upcoming', 'score': {'teamA': 0, 'teamB': 0},
        },
        {
            'id': 'match-a-3', 'phase': 'group', 'stageLabel': 'A조 3차전',
            'group': 'A', 'weekLabel': '1주차',
            'kickoffAt': '2026-03-20T12:45:00+09:00',
            'teamAId': 'team-3-6', 'teamBId': 'team-3-9',
            'status': 'upcoming', 'score': {'teamA': 0, 'teamB': 0},
        },
        {
            'id': 'match-a-4', 'phase': 'group', 'stageLabel': 'A조 4차전',
            'group': 'A', 'weekLabel': '2주차',
            'kickoffAt': '2026-03-23T12:45:00+09:00',
            'teamAId': 'team-3-8', 'teamBId': 'team-3-10',
            'status': 'upcoming', 'score': {'teamA': 0, 'teamB': 0},
        },
        {
            'id': 'match-b-2', 'phase': 'group', 'stageLabel': 'B조 2차전',
            'group': 'B', 'weekLabel': '2주차',
            'kickoffAt': '2026-03-25T12:45:00+09:00',
            'teamAId': 'team-3-1-3-3', 'teamBId': 'team-3-5-3-7',
            'status': 'upcoming', 'score': {'teamA': 0, 'teamB': 0},
        },
        {
            'id': 'match-a-5', 'phase': 'group', 'stageLabel': 'A조 5차전',
            'group': 'A', 'weekLabel': '3주차',
            'kickoffAt': '2026-03-30T12:45:00+09:00',
            'teamAId': 'team-3-6', 'teamBId': 'team-3-10',
            'status': 'upcoming', 'score': {'teamA': 0, 'teamB': 0},
        },
        {
            'id': 'match-a-6', 'phase': 'group', 'stageLabel': 'A조 6차전',
            'group': 'A', 'weekLabel': '3주차',
            'kickoffAt': '2026-04-01T12:45:00+09:00',
            'teamAId': 'team-3-8', 'teamBId': 'team-3-9',
            'status': 'upcoming', 'score': {'teamA': 0, 'teamB': 0},
        },
        {
            'id': 'match-b-3', 'phase': 'group', 'stageLabel': 'B조 3차전',
            'group': 'B', 'weekLabel': '3주차',
            'kickoffAt': '2026-04-02T12:45:00+09:00',
            'teamAId': 'team-3-2-3-4', 'teamBId': 'team-3-5-3-7',
            'status': 'upcoming', 'score': {'teamA': 0, 'teamB': 0},
        },
        {
            'id': 'match-semi-1', 'phase': 'knockout', 'stageLabel': '준결승 1차전',
            'group': 'K', 'weekLabel': '3주차',
            'kickoffAt': '2026-04-03T12:45:00+09:00',
            'teamAId': 'placeholder-a-1', 'teamBId': 'placeholder-b-2',
            'status': 'upcoming', 'score': {'teamA': 0, 'teamB': 0},
        },
        {
            'id': 'match-semi-2', 'phase': 'knockout', 'stageLabel': '준결승 2차전',
            'group': 'K', 'weekLabel': '4주차',
            'kickoffAt': '2026-04-06T12:45:00+09:00',
            'teamAId': 'placeholder-b-1', 'teamBId': 'placeholder-a-2',
            'status': 'upcoming', 'score': {'teamA': 0, 'teamB': 0},
        },
        {
            'id': 'match-final', 'phase': 'final', 'stageLabel': '결승전',
            'group': 'K', 'weekLabel': '4주차',
            'kickoffAt': '2026-04-08T12:45:00+09:00',
            'teamAId': 'placeholder-semi-1-winner', 'teamBId': 'placeholder-semi-2-winner',
            'status': 'upcoming', 'score': {'teamA': 0, 'teamB': 0},
        },
    ],
    'rules': {
        'format': [
            '8대8 경기로 진행됩니다.',
            '교체 횟수 제한은 없습니다.',
            '선수 집합은 12:42, 전반은 12:45~13:05, 후반은 13:06~13:26입니다.',
        ],
        'points': ['승리 3점', '무승부 1점', '패배 0점'],
        'ranking': ['득실차', '다득점', '맞대결 결과', '동전던지기'],
        'notes': [
            '집합 시간 미준수로 인한 인원 부족은 그대로 진행되며 불이익은 반별 책임입니다.',
            '4강 토너먼트부터 무승부 시 청소시간 승부차기로 승패를 결정합니다.',
            '심판 판정 불응 또는 규칙 위반 시 반대항전이 중단될 수 있습니다.',
            '이번 반대항전부터 옐로카드와 레드카드가 도입됩니다.',
        ],
    },
}


def get_sports_league_seed(category_id):
    if category_id != SPORTS_LEAGUE_CATEGORY_ID:
        return None
    return SPORTS_LEAGUE_SEED
