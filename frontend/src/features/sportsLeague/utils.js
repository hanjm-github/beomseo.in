/**
 * @file src/features/sportsLeague/utils.js
 * @description Supplies pure helpers for sports league live text pages.
 */

import { SPORTS_EVENT_TEMPLATES, SPORTS_LEAGUE_CATEGORY_ID, SPORTS_LEAGUE_SEED } from './data';

const DISPLAY_TIME_ZONE = 'Asia/Seoul';
const MATCH_HALF_DURATION_MINUTES = 20;
const MATCH_BREAK_DURATION_MINUTES = 1;
const MATCH_KICKOFF_HIGHLIGHT_MINUTES = 1;
const IN_PROGRESS_MATCH_STATUSES = new Set(['kickoff', 'live', 'halftime']);
const SCORE_VISIBLE_MATCH_STATUSES = new Set(['kickoff', 'live', 'halftime', 'completed']);

const koDateFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: DISPLAY_TIME_ZONE,
  month: 'numeric',
  day: 'numeric',
  weekday: 'short',
});

const koTimeFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: DISPLAY_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const koDateTimeFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: DISPLAY_TIME_ZONE,
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const STATUS_LABELS = {
  kickoff: '경기 시작',
  live: '진행 중',
  halftime: '하프타임',
  completed: '경기 종료',
  upcoming: '예정',
  pending: '운영 업데이트 대기',
};

const EVENT_TONE_MAP = {
  note: 'neutral',
  kickoff: 'info',
  goal: 'goal',
  yellow: 'warning',
  red: 'danger',
  halftime: 'accent',
  second_half: 'info',
  fulltime: 'success',
};

export function cloneSportsLeagueSnapshot(snapshot) {
  return JSON.parse(JSON.stringify(snapshot));
}

export function getSportsLeagueSeed(categoryId) {
  if (categoryId !== SPORTS_LEAGUE_CATEGORY_ID) return null;
  return cloneSportsLeagueSnapshot(SPORTS_LEAGUE_SEED);
}

export function getSportsLeagueEventTemplate(eventType) {
  return SPORTS_EVENT_TEMPLATES.find((item) => item.id === eventType) || SPORTS_EVENT_TEMPLATES[0];
}

export function getDefaultStatusForEventType(eventType) {
  return getSportsLeagueEventTemplate(eventType)?.defaultStatus || null;
}

export function createTeamsMap(teams = []) {
  return Object.fromEntries((teams || []).map((team) => [team.id, team]));
}

export function formatSportsDate(isoString) {
  if (!isoString) return '-';
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) return '-';
  return koDateFormatter.format(parsed);
}

export function formatSportsTime(isoString) {
  if (!isoString) return '-';
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) return '-';
  return koTimeFormatter.format(parsed);
}

export function formatSportsDateTime(isoString) {
  if (!isoString) return '-';
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) return '-';
  return koDateTimeFormatter.format(parsed);
}

export function getMatchWindow(match) {
  const kickoff = new Date(match.kickoffAt);
  const halftimeStart = new Date(kickoff.getTime() + MATCH_HALF_DURATION_MINUTES * 60 * 1000);
  const secondHalfStart = new Date(
    halftimeStart.getTime() + MATCH_BREAK_DURATION_MINUTES * 60 * 1000
  );
  const fulltime = new Date(secondHalfStart.getTime() + MATCH_HALF_DURATION_MINUTES * 60 * 1000);
  return { kickoff, halftimeStart, secondHalfStart, fulltime };
}

export function formatMatchTimeRange(match) {
  const { kickoff, halftimeStart, secondHalfStart, fulltime } = getMatchWindow(match);
  return `${koTimeFormatter.format(kickoff)} 킥오프 · ${koTimeFormatter.format(
    halftimeStart
  )} 전반 종료 · ${koTimeFormatter.format(secondHalfStart)} 후반 시작 · ${koTimeFormatter.format(
    fulltime
  )} 경기 종료`;
}

export function isInProgressMatchStatus(status) {
  return IN_PROGRESS_MATCH_STATUSES.has(status);
}

export function isScoreVisibleMatchStatus(status) {
  return SCORE_VISIBLE_MATCH_STATUSES.has(status);
}

export function getResolvedMatchStatus(match, now = new Date()) {
  if (!match) return 'upcoming';
  const { kickoff, halftimeStart, secondHalfStart, fulltime } = getMatchWindow(match);

  if (match.status === 'completed') return 'completed';
  if (match.status === 'kickoff') {
    const kickoffHighlightEnd = new Date(
      kickoff.getTime() + MATCH_KICKOFF_HIGHLIGHT_MINUTES * 60 * 1000
    );
    if (now >= kickoff && now < kickoffHighlightEnd) return 'kickoff';
  }
  if (match.status === 'live') return 'live';
  if (match.status === 'halftime') return 'halftime';

  if (now >= kickoff && now < halftimeStart) return 'live';
  if (now >= halftimeStart && now < secondHalfStart) return 'halftime';
  if (now >= secondHalfStart && now < fulltime) return 'live';
  // Pending highlights fixtures that likely ended on schedule but still await an operator fulltime event.
  if (now >= fulltime) return 'pending';
  return 'upcoming';
}

export function getMatchStatusLabel(status) {
  return STATUS_LABELS[status] || STATUS_LABELS.upcoming;
}

export function sortMatchesByKickoff(matches = []) {
  return [...matches].sort((left, right) => new Date(left.kickoffAt) - new Date(right.kickoffAt));
}

export function getCurrentMatch(matches = [], now = new Date()) {
  return (
    sortMatchesByKickoff(matches).find((match) => {
      const status = getResolvedMatchStatus(match, now);
      return isInProgressMatchStatus(status);
    }) || null
  );
}

export function getNextMatch(matches = [], now = new Date()) {
  return (
    sortMatchesByKickoff(matches).find(
      (match) => match.status !== 'completed' && new Date(match.kickoffAt) > now
    ) || null
  );
}

export function getUpcomingMatches(matches = [], now = new Date()) {
  return sortMatchesByKickoff(matches).filter(
    (match) => match.status !== 'completed' && new Date(match.kickoffAt) > now
  );
}

export function getArchivedMatches(matches = []) {
  return sortMatchesByKickoff(matches)
    .filter((match) => match.status === 'completed')
    .sort((left, right) => new Date(right.kickoffAt) - new Date(left.kickoffAt));
}

export function getFocusedMatchId(snapshot, requestedMatchId, now = new Date()) {
  const matches = snapshot?.matches || [];
  if (requestedMatchId && matches.some((match) => match.id === requestedMatchId)) {
    return requestedMatchId;
  }

  return (
    getCurrentMatch(matches, now)?.id ||
    getNextMatch(matches, now)?.id ||
    getArchivedMatches(matches)[0]?.id ||
    sortMatchesByKickoff(matches)[0]?.id ||
    null
  );
}

export function getMatchEvents(snapshot, matchId, order = 'desc') {
  const filtered = (snapshot?.liveEvents || []).filter((event) => event.matchId === matchId);
  filtered.sort((left, right) => {
    const delta = new Date(left.createdAt) - new Date(right.createdAt);
    return order === 'asc' ? delta : -delta;
  });
  return filtered;
}

export function groupMatchesByWeek(matches = []) {
  return sortMatchesByKickoff(matches).reduce((accumulator, match) => {
    const key = match.weekLabel || '기타';
    const current = accumulator.find((item) => item.weekLabel === key);
    if (current) {
      current.matches.push(match);
      return accumulator;
    }
    accumulator.push({ weekLabel: key, matches: [match] });
    return accumulator;
  }, []);
}

export function getEventTone(eventType) {
  return EVENT_TONE_MAP[eventType] || EVENT_TONE_MAP.note;
}

export function buildDefaultEventMessage({
  eventType,
  teamName,
  message,
  scoreSnapshot,
  stageLabel,
}) {
  const trimmed = String(message || '').trim();
  if (trimmed) return trimmed;

  switch (eventType) {
    case 'kickoff':
      return `${stageLabel} 경기 시작`;
    case 'goal':
      return `${teamName || '한 팀'} 득점! ${scoreSnapshot?.teamA ?? 0}:${scoreSnapshot?.teamB ?? 0}`;
    case 'yellow':
      return `${teamName || '선수'}에게 옐로카드가 주어졌습니다.`;
    case 'red':
      return `${teamName || '선수'}에게 레드카드가 선언됐습니다.`;
    case 'halftime':
      return `${stageLabel} 전반 종료`;
    case 'second_half':
      return `${stageLabel} 후반 시작`;
    case 'fulltime':
      return `${stageLabel} 경기 종료`;
    default:
      return `${stageLabel} 운영 업데이트`;
  }
}

export function describeMatch(match, teamsMap) {
  const teamA = teamsMap[match.teamAId];
  const teamB = teamsMap[match.teamBId];
  return `${teamA?.shortName || teamA?.name || match.teamAId} vs ${
    teamB?.shortName || teamB?.name || match.teamBId
  }`;
}

export function computeStandings(snapshot, groupId) {
  const groupTeams = (snapshot?.teams || []).filter((team) => team.group === groupId);
  const completedMatches = (snapshot?.matches || []).filter(
    (match) => match.group === groupId && match.status === 'completed'
  );
  const overrides = snapshot?.standingsOverrides?.[groupId];

  if (Array.isArray(overrides) && overrides.length) {
    // Official override rows replace the derived table verbatim and can carry operator notes.
    const mapped = overrides
      .map((override, index) => {
        const team = groupTeams.find((item) => item.id === override.teamId);
        if (!team) return null;
        return {
          rank: override.rank ?? index + 1,
          team,
          points: override.points ?? 0,
          goalDifference: override.goalDifference ?? 0,
          goalsFor: override.goalsFor ?? 0,
          goalsAgainst: override.goalsAgainst ?? 0,
          wins: override.wins ?? 0,
          draws: override.draws ?? 0,
          losses: override.losses ?? 0,
          note: override.note || '공식 확정 순위',
          isOfficialOverride: true,
        };
      })
      .filter(Boolean)
      .sort((left, right) => left.rank - right.rank);

    return {
      rows: mapped,
      warnings: mapped.some((row) => row.note) ? [] : ['운영진 확정 순위가 반영되었습니다.'],
      isOfficialOverride: true,
    };
  }

  const baseRows = groupTeams.map((team) => ({
    rank: 0,
    team,
    points: 0,
    goalDifference: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    note: '',
    isOfficialOverride: false,
  }));

  const rowMap = Object.fromEntries(baseRows.map((row) => [row.team.id, row]));

  completedMatches.forEach((match) => {
    const home = rowMap[match.teamAId];
    const away = rowMap[match.teamBId];
    if (!home || !away) return;

    const homeGoals = Number(match.score?.teamA ?? 0);
    const awayGoals = Number(match.score?.teamB ?? 0);

    home.goalsFor += homeGoals;
    home.goalsAgainst += awayGoals;
    away.goalsFor += awayGoals;
    away.goalsAgainst += homeGoals;
    home.goalDifference = home.goalsFor - home.goalsAgainst;
    away.goalDifference = away.goalsFor - away.goalsAgainst;

    if (homeGoals > awayGoals) {
      home.wins += 1;
      away.losses += 1;
      home.points += 3;
    } else if (homeGoals < awayGoals) {
      away.wins += 1;
      home.losses += 1;
      away.points += 3;
    } else {
      home.draws += 1;
      away.draws += 1;
      home.points += 1;
      away.points += 1;
    }
  });

  const warnings = [];

  const compareRows = (left, right) => {
    if (right.points !== left.points) return right.points - left.points;
    if (right.goalDifference !== left.goalDifference) {
      return right.goalDifference - left.goalDifference;
    }
    if (right.goalsFor !== left.goalsFor) return right.goalsFor - left.goalsFor;

    const headToHead = completedMatches.find(
      (match) =>
        (match.teamAId === left.team.id && match.teamBId === right.team.id) ||
        (match.teamAId === right.team.id && match.teamBId === left.team.id)
    );

    if (headToHead) {
      const leftScore = headToHead.teamAId === left.team.id ? headToHead.score.teamA : headToHead.score.teamB;
      const rightScore =
        headToHead.teamAId === right.team.id ? headToHead.score.teamA : headToHead.score.teamB;

      if (leftScore !== rightScore) {
        return rightScore - leftScore;
      }
    }

    return left.team.name.localeCompare(right.team.name, 'ko');
  };

  const rows = [...baseRows].sort(compareRows).map((row, index) => ({
    ...row,
    rank: index + 1,
  }));

  const unresolvedTieGroups = rows.reduce((accumulator, row) => {
    const signature = `${row.points}-${row.goalDifference}-${row.goalsFor}`;
    accumulator[signature] = accumulator[signature] || [];
    accumulator[signature].push(row);
    return accumulator;
  }, {});

  Object.values(unresolvedTieGroups).forEach((groupRows) => {
    if (groupRows.length >= 3) {
      warnings.push('3팀 이상 동률 구간은 운영진 공식 순위 확정이 필요합니다.');
      return;
    }

    if (groupRows.length === 2) {
      const [left, right] = groupRows;
      const headToHead = completedMatches.find(
        (match) =>
          (match.teamAId === left.team.id && match.teamBId === right.team.id) ||
          (match.teamAId === right.team.id && match.teamBId === left.team.id)
      );

      if (!headToHead || headToHead.score.teamA === headToHead.score.teamB) {
        warnings.push(`${left.team.shortName} / ${right.team.shortName} 순위는 운영진 최종 확정이 필요합니다.`);
      }
    }
  });

  return { rows, warnings, isOfficialOverride: false };
}
