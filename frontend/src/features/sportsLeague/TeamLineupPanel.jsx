/**
 * @file src/features/sportsLeague/TeamLineupPanel.jsx
 * @description Team lineup sub-tab panel showing players per team.
 * Teams are ordered with next-match teams first, then by group & name.
 */

import { useMemo, useState } from 'react';
import { Plus, Trash2, UserPlus } from 'lucide-react';
import styles from '../../pages/SchoolInfo/SportsLeagueCategoryPage.module.css';

export default function TeamLineupPanel({
    teams,
    players,
    loading = false,
    error = '',
    matches,
    now,
    canManage,
    onAddPlayer,
    onRemovePlayer,
}) {
    // Find the next upcoming match to prioritize those teams.
    const nextMatch = useMemo(() => {
        const upcoming = [...(matches || [])]
            .filter((m) => m.status !== 'completed' && new Date(m.kickoffAt) > now)
            .sort((a, b) => new Date(a.kickoffAt) - new Date(b.kickoffAt));
        return upcoming[0] || null;
    }, [matches, now]);

    // Only show real teams (group A or B), exclude placeholder teams.
    const realTeams = useMemo(() => {
        return (teams || []).filter((t) => t.group === 'A' || t.group === 'B');
    }, [teams]);

    // Sort teams: next-match teams first, then by group A→B, then by name.
    const sortedTeams = useMemo(() => {
        const nextTeamIds = new Set();
        if (nextMatch) {
            nextTeamIds.add(nextMatch.teamAId);
            nextTeamIds.add(nextMatch.teamBId);
        }

        return [...realTeams].sort((a, b) => {
            const aIsNext = nextTeamIds.has(a.id) ? 0 : 1;
            const bIsNext = nextTeamIds.has(b.id) ? 0 : 1;
            if (aIsNext !== bIsNext) return aIsNext - bIsNext;
            if (a.group !== b.group) return a.group.localeCompare(b.group);
            const orderDiff = (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
            if (orderDiff !== 0) return orderDiff;
            return a.name.localeCompare(b.name, 'ko');
        });
    }, [realTeams, nextMatch]);

    const [selectedTeamId, setSelectedTeamId] = useState('');
    const [newPlayerName, setNewPlayerName] = useState('');
    const [actionError, setActionError] = useState('');

    // Default to first team in sorted list.
    const activeTeamId = selectedTeamId && sortedTeams.find((t) => t.id === selectedTeamId)
        ? selectedTeamId
        : sortedTeams[0]?.id || '';

    const activeTeam = sortedTeams.find((t) => t.id === activeTeamId);
    const teamPlayers = useMemo(
        () => (players || []).filter((p) => p.teamId === activeTeamId),
        [players, activeTeamId]
    );

    const nextTeamIds = useMemo(() => {
        if (!nextMatch) return new Set();
        return new Set([nextMatch.teamAId, nextMatch.teamBId]);
    }, [nextMatch]);

    const handleAddPlayer = async (e) => {
        e.preventDefault();
        if (!newPlayerName.trim() || !activeTeamId) return;
        try {
            setActionError('');
            await onAddPlayer(activeTeamId, newPlayerName.trim());
            setNewPlayerName('');
        } catch (issue) {
            setActionError(issue?.message || '선수 추가에 실패했습니다.');
        }
    };

    const handleRemovePlayer = async (playerId, playerName) => {
        const confirmed = window.confirm(`${playerName} 선수를 라인업에서 삭제할까요?`);
        if (!confirmed) return;
        try {
            setActionError('');
            await onRemovePlayer(playerId);
        } catch (issue) {
            setActionError(issue?.message || '선수 삭제에 실패했습니다.');
        }
    };

    if (!sortedTeams.length) {
        return (
            <section
                id="sports-panel-lineup"
                role="tabpanel"
                aria-labelledby="sports-tab-lineup"
                className={styles.tabPanel}
            >
                <div className={styles.placeholderBlock}>등록된 팀이 없습니다.</div>
            </section>
        );
    }

    return (
        <section
            id="sports-panel-lineup"
            role="tabpanel"
            aria-labelledby="sports-tab-lineup"
            className={styles.tabPanel}
        >
            <article className={styles.panelCard}>
                <div className={styles.sectionHeader}>
                    <div>
                        <p className={styles.sectionEyebrow}>팀별 라인업</p>
                        <h2 className={styles.sectionTitle}>선수 명단</h2>
                    </div>
                    <p className={styles.sectionHint}>
                        팀을 선택하여 해당 팀의 선수 목록을 확인하세요.
                    </p>
                </div>

                {/* Team sub-tabs */}
                <div className={styles.lineupTeamTabs} role="tablist" aria-label="팀 선택">
                    {sortedTeams.map((team) => (
                        <button
                            key={team.id}
                            type="button"
                            role="tab"
                            aria-selected={activeTeamId === team.id}
                            className={`chip ${styles.lineupTeamChip} ${activeTeamId === team.id ? 'chip-active' : ''
                                } ${nextTeamIds.has(team.id) ? styles.lineupTeamChipNext : ''}`}
                            onClick={() => setSelectedTeamId(team.id)}
                        >
                            {team.shortName}
                            {nextTeamIds.has(team.id) && (
                                <span className={styles.lineupNextBadge}>다음</span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Player list */}
                <div className={styles.lineupPlayerList}>
                    {loading ? (
                        <div className={styles.placeholderBlock}>선수 명단을 불러오는 중입니다.</div>
                    ) : error ? (
                        <div className={styles.placeholderBlock}>{error}</div>
                    ) : teamPlayers.length === 0 ? (
                        <div className={styles.placeholderBlock}>
                            {activeTeam?.shortName || '해당 팀'}에 등록된 선수가 없습니다.
                        </div>
                    ) : (
                        teamPlayers.map((player, idx) => (
                            <div key={player.id} className={styles.lineupPlayerCard}>
                                <div className={styles.lineupPlayerInfo}>
                                    <span className={styles.lineupPlayerNumber}>{idx + 1}</span>
                                    <span className={styles.lineupPlayerName}>{player.name}</span>
                                </div>
                                <div className={styles.lineupPlayerStats}>
                                    <span className={styles.lineupStatItem}>
                                        <span className={styles.lineupStatIcon}>⚽</span>
                                        <span className={styles.lineupStatValue}>{player.goals || 0}</span>
                                    </span>
                                    <span className={styles.lineupStatItem}>
                                        <span className={styles.lineupStatIcon}>🅰️</span>
                                        <span className={styles.lineupStatValue}>{player.assists || 0}</span>
                                    </span>
                                    {canManage && (
                                        <button
                                            type="button"
                                            className={styles.lineupRemoveBtn}
                                            onClick={() => handleRemovePlayer(player.id, player.name)}
                                            aria-label={`${player.name} 삭제`}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {actionError ? <p className={styles.errorText}>{actionError}</p> : null}

                {/* Add player form (manager only) */}
                {canManage && (
                    <form className={styles.lineupAddForm} onSubmit={handleAddPlayer}>
                        <div className={styles.lineupAddInputWrap}>
                            <UserPlus size={16} className={styles.lineupAddIcon} />
                            <input
                                type="text"
                                className={styles.lineupAddInput}
                                placeholder="선수 이름 입력"
                                value={newPlayerName}
                                onChange={(e) => setNewPlayerName(e.target.value)}
                                maxLength={20}
                            />
                        </div>
                        <button
                            type="submit"
                            className={`btn btn-primary ${styles.lineupAddBtn}`}
                            disabled={!newPlayerName.trim()}
                        >
                            <Plus size={16} />
                            추가
                        </button>
                    </form>
                )}
            </article>
        </section>
    );
}
