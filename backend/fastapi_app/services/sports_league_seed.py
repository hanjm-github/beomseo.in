"""
Seed data and event defaults for the sports league live text feature.

Seeds are kept as code so operators can review schedule changes in version
control and bootstrap them idempotently into the shared MariaDB database.
"""
from __future__ import annotations

from copy import deepcopy


SPORTS_LEAGUE_CATEGORY_ID = '2026-spring-grade2-boys-soccer'
LEGACY_SPORTS_LEAGUE_CATEGORY_ID = '2026-spring-grade3-boys-soccer'
SPORTS_LEAGUE_STORAGE_VERSION = '2026.05.26'
LEGACY_SPORTS_LEAGUE_STORAGE_VERSION = '2026.03.15'

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

GRADE2_SPORTS_LEAGUE_SEED = {
    'storageVersion': SPORTS_LEAGUE_STORAGE_VERSION,
    'category': {
        'id': SPORTS_LEAGUE_CATEGORY_ID,
        'title': '2026 1학기 2학년 남자 축구',
        'subtitle': '스포츠리그 반대항전 문자중계',
        'seasonLabel': '2026 1학기',
        'gradeLabel': '2학년',
        'sportLabel': '남자 축구',
        'statusNote': '실시간 문자중계 등록은 학생회와 관리자만 가능합니다.',
        'scheduleWindowLabel': '2026.05.26 ~ 2026.06.08',
        'matchTimeLabel': '11:45 킥오프 · 전후반 각 20분 · 1분 휴식',
        'broadcastLabel': '실시간 SSE 문자중계',
        'locationLabel': '범서고등학교 스포츠리그',
    },
    'teams': [
        {'id': 'g2-team-2-6-2-9', 'name': '2-6·2-9', 'shortName': '2-6·2-9', 'group': 'A', 'tone': 'groupA'},
        {'id': 'g2-team-2-1-2-7', 'name': '2-1·2-7', 'shortName': '2-1·2-7', 'group': 'A', 'tone': 'groupA'},
        {'id': 'g2-team-2-2-2-10', 'name': '2-2·2-10', 'shortName': '2-2·2-10', 'group': 'A', 'tone': 'groupA'},
        {'id': 'g2-team-2-4-2-8', 'name': '2-4·2-8', 'shortName': '2-4·2-8', 'group': 'B', 'tone': 'groupB'},
        {'id': 'g2-team-2-5', 'name': '2-5', 'shortName': '2-5', 'group': 'B', 'tone': 'groupB'},
        {'id': 'g2-team-2-3', 'name': '2-3', 'shortName': '2-3', 'group': 'B', 'tone': 'groupB'},
        {
            'id': 'g2-placeholder-a-1',
            'name': 'A조 1위',
            'shortName': 'A조 1위',
            'group': 'K',
            'tone': 'knockout',
        },
        {
            'id': 'g2-placeholder-a-2',
            'name': 'A조 2위',
            'shortName': 'A조 2위',
            'group': 'K',
            'tone': 'knockout',
        },
        {
            'id': 'g2-placeholder-b-1',
            'name': 'B조 1위',
            'shortName': 'B조 1위',
            'group': 'K',
            'tone': 'knockout',
        },
        {
            'id': 'g2-placeholder-b-2',
            'name': 'B조 2위',
            'shortName': 'B조 2위',
            'group': 'K',
            'tone': 'knockout',
        },
        {
            'id': 'g2-placeholder-semi-1-winner',
            'name': '1경기 승자',
            'shortName': '1경기 승자',
            'group': 'K',
            'tone': 'knockout',
        },
        {
            'id': 'g2-placeholder-semi-2-winner',
            'name': '2경기 승자',
            'shortName': '2경기 승자',
            'group': 'K',
            'tone': 'knockout',
        },
    ],
    'matches': [
        {
            'id': 'g2-match-a-1', 'phase': 'group', 'stageLabel': 'A조 1차전',
            'group': 'A', 'weekLabel': '예선 1주차',
            'kickoffAt': '2026-05-26T11:45:00+09:00',
            'teamAId': 'g2-team-2-6-2-9', 'teamBId': 'g2-team-2-1-2-7',
            'status': 'upcoming', 'score': {'teamA': 0, 'teamB': 0},
        },
        {
            'id': 'g2-match-b-1', 'phase': 'group', 'stageLabel': 'B조 1차전',
            'group': 'B', 'weekLabel': '예선 1주차',
            'kickoffAt': '2026-05-27T11:45:00+09:00',
            'teamAId': 'g2-team-2-4-2-8', 'teamBId': 'g2-team-2-5',
            'status': 'upcoming', 'score': {'teamA': 0, 'teamB': 0},
        },
        {
            'id': 'g2-match-a-2', 'phase': 'group', 'stageLabel': 'A조 2차전',
            'group': 'A', 'weekLabel': '예선 1주차',
            'kickoffAt': '2026-05-28T11:45:00+09:00',
            'teamAId': 'g2-team-2-1-2-7', 'teamBId': 'g2-team-2-2-2-10',
            'status': 'upcoming', 'score': {'teamA': 0, 'teamB': 0},
        },
        {
            'id': 'g2-match-b-2', 'phase': 'group', 'stageLabel': 'B조 2차전',
            'group': 'B', 'weekLabel': '예선 1주차',
            'kickoffAt': '2026-05-29T11:45:00+09:00',
            'teamAId': 'g2-team-2-5', 'teamBId': 'g2-team-2-3',
            'status': 'upcoming', 'score': {'teamA': 0, 'teamB': 0},
        },
        {
            'id': 'g2-match-a-3', 'phase': 'group', 'stageLabel': 'A조 3차전',
            'group': 'A', 'weekLabel': '예선 2주차',
            'kickoffAt': '2026-06-01T11:45:00+09:00',
            'teamAId': 'g2-team-2-2-2-10', 'teamBId': 'g2-team-2-6-2-9',
            'status': 'upcoming', 'score': {'teamA': 0, 'teamB': 0},
        },
        {
            'id': 'g2-match-b-3', 'phase': 'group', 'stageLabel': 'B조 3차전',
            'group': 'B', 'weekLabel': '예선 2주차',
            'kickoffAt': '2026-06-02T11:45:00+09:00',
            'teamAId': 'g2-team-2-3', 'teamBId': 'g2-team-2-4-2-8',
            'status': 'upcoming', 'score': {'teamA': 0, 'teamB': 0},
        },
        {
            'id': 'g2-match-semi-1', 'phase': 'knockout', 'stageLabel': '준결승 1경기',
            'group': 'K', 'weekLabel': '본선',
            'kickoffAt': '2026-06-04T11:45:00+09:00',
            'teamAId': 'g2-placeholder-a-2', 'teamBId': 'g2-placeholder-b-1',
            'status': 'upcoming', 'score': {'teamA': 0, 'teamB': 0},
        },
        {
            'id': 'g2-match-semi-2', 'phase': 'knockout', 'stageLabel': '준결승 2경기',
            'group': 'K', 'weekLabel': '본선',
            'kickoffAt': '2026-06-05T11:45:00+09:00',
            'teamAId': 'g2-placeholder-a-1', 'teamBId': 'g2-placeholder-b-2',
            'status': 'upcoming', 'score': {'teamA': 0, 'teamB': 0},
        },
        {
            'id': 'g2-match-final', 'phase': 'final', 'stageLabel': '결승전',
            'group': 'K', 'weekLabel': '결승',
            'kickoffAt': '2026-06-08T11:45:00+09:00',
            'teamAId': 'g2-placeholder-semi-1-winner', 'teamBId': 'g2-placeholder-semi-2-winner',
            'status': 'upcoming', 'score': {'teamA': 0, 'teamB': 0},
        },
    ],
    'rules': {
        'format': [
            '예선은 A조와 B조로 나누어 조별 풀리그로 진행됩니다.',
            '각 조 상위 2팀이 4강 본선에 진출합니다.',
            '4강과 결승에서 승부가 나지 않을 경우 승부차기로 승리 팀을 결정합니다.',
        ],
        'points': ['승리 3점', '무승부 1점', '패배 0점'],
        'ranking': ['승점', '득실차', '다득점', '승부차기 또는 운영진 확정 순위'],
        'notes': [
            '승점이 같을 경우 득실차, 다득점 순으로 순위를 산정합니다.',
            '득실차와 다득점까지 같으면 승부차기를 진행하거나 운영진 확정 순위를 반영합니다.',
            '4강과 결승에서는 동점 종료 시 승부차기를 진행합니다.',
        ],
    },
}

GRADE3_SPORTS_LEAGUE_SEED = {
    'storageVersion': LEGACY_SPORTS_LEAGUE_STORAGE_VERSION,
    'category': {
        'id': LEGACY_SPORTS_LEAGUE_CATEGORY_ID,
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

SPORTS_LEAGUE_SEEDS = {
    SPORTS_LEAGUE_CATEGORY_ID: GRADE2_SPORTS_LEAGUE_SEED,
    LEGACY_SPORTS_LEAGUE_CATEGORY_ID: GRADE3_SPORTS_LEAGUE_SEED,
}


def get_default_sports_league_category_id():
    # The first-class default is the entry point used by redirects and category pickers.
    return SPORTS_LEAGUE_CATEGORY_ID


def get_sports_league_seed(category_id):
    seed = SPORTS_LEAGUE_SEEDS.get(category_id)
    # Return copies so bootstrap callers cannot mutate the process-wide seed registry.
    return deepcopy(seed) if seed else None


def iter_sports_league_seeds():
    # Dict insertion order is the category switcher order exposed to clients.
    for category_id, seed in SPORTS_LEAGUE_SEEDS.items():
        yield category_id, deepcopy(seed)


def list_sports_league_seed_summaries():
    items = []
    for category_id, seed in iter_sports_league_seeds():
        category = seed['category']
        items.append({
            'id': category_id,
            'title': category['title'],
            'seasonLabel': category['seasonLabel'],
            'gradeLabel': category['gradeLabel'],
            'sportLabel': category['sportLabel'],
            'scheduleWindowLabel': category['scheduleWindowLabel'],
            'storageVersion': seed.get('storageVersion') or SPORTS_LEAGUE_STORAGE_VERSION,
        })
    return items
