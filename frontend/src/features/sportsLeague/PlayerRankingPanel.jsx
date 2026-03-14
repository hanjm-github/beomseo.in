/**
 * @file src/features/sportsLeague/PlayerRankingPanel.jsx
 * @description Individual player ranking panel with goals/assists sub-tabs.
 * Managers can increment/decrement stats inline.
 */

import { useMemo, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import styles from '../../pages/SchoolInfo/SportsLeagueCategoryPage.module.css';

const RANKING_SUB_TABS = [
    { key: 'goals', label: '득점' },
    { key: 'assists', label: '어시스트' },
];

export default function PlayerRankingPanel({
    players,
    loading = false,
    error = '',
    teamsMap,
    canManage,
    onIncrementStat,
    onDecrementStat,
}) {
    const [activeStat, setActiveStat] = useState('goals');
    const [actionError, setActionError] = useState('');

    const rankedPlayers = useMemo(() => {
        const list = [...(players || [])];
        list.sort((a, b) => {
            const diff = (b[activeStat] || 0) - (a[activeStat] || 0);
            if (diff !== 0) return diff;
            // Secondary sort by the other stat descending.
            const otherStat = activeStat === 'goals' ? 'assists' : 'goals';
            const otherDiff = (b[otherStat] || 0) - (a[otherStat] || 0);
            if (otherDiff !== 0) return otherDiff;
            return a.name.localeCompare(b.name, 'ko');
        });
        return list;
    }, [players, activeStat]);

    const handleStatChange = async (playerId, stat, delta) => {
        try {
            setActionError('');
            if (delta > 0) {
                await onIncrementStat(playerId, stat);
                return;
            }
            await onDecrementStat(playerId, stat);
        } catch (issue) {
            setActionError(issue?.message || '선수 기록 수정에 실패했습니다.');
        }
    };

    return (
        <section
            id="sports-panel-playerRanking"
            role="tabpanel"
            aria-labelledby="sports-tab-playerRanking"
            className={styles.tabPanel}
        >
            <article className={styles.panelCard}>
                <div className={styles.sectionHeader}>
                    <div>
                        <p className={styles.sectionEyebrow}>개인별 순위</p>
                        <h2 className={styles.sectionTitle}>
                            {activeStat === 'goals' ? '득점 순위' : '어시스트 순위'}
                        </h2>
                    </div>
                    <p className={styles.sectionHint}>
                        {activeStat === 'goals'
                            ? '개인 득점 기준 내림차순으로 정렬됩니다.'
                            : '개인 어시스트 기준 내림차순으로 정렬됩니다.'}
                    </p>
                </div>

                {/* Sub-tabs: Goals | Assists */}
                <div className={styles.rankingSubTabs} role="tablist" aria-label="순위 기준">
                    {RANKING_SUB_TABS.map((tab) => (
                        <button
                            key={tab.key}
                            type="button"
                            role="tab"
                            aria-selected={activeStat === tab.key}
                            className={`chip ${styles.rankingSubChip} ${activeStat === tab.key ? 'chip-active' : ''
                                }`}
                            onClick={() => setActiveStat(tab.key)}
                        >
                            {tab.key === 'goals' ? '⚽ ' : '🅰️ '}
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Ranking list */}
                <div className={styles.rankingList}>
                    {/* Header row */}
                    <div className={`${styles.rankingRow} ${styles.rankingRowHeader}`}>
                        <span className={styles.rankingRank}>#</span>
                        <span className={styles.rankingName}>선수</span>
                        <span className={styles.rankingTeam}>소속</span>
                        <span className={styles.rankingStatCell}>⚽</span>
                        <span className={styles.rankingStatCell}>🅰️</span>
                        {canManage && <span className={styles.rankingActions}>관리</span>}
                    </div>

                    {loading ? (
                        <div className={styles.placeholderBlock}>선수 순위를 불러오는 중입니다.</div>
                    ) : error ? (
                        <div className={styles.placeholderBlock}>{error}</div>
                    ) : rankedPlayers.length === 0 ? (
                        <div className={styles.placeholderBlock}>등록된 선수가 없습니다.</div>
                    ) : (
                        rankedPlayers.map((player, idx) => {
                            const team = teamsMap[player.teamId];

                            return (
                                <div
                                    key={player.id}
                                    className={`${styles.rankingRow} ${idx < 3 ? styles.rankingRowTop : ''
                                        }`}
                                >
                                    <span className={styles.rankingRank}>
                                        <span className={styles.rankBadge}>{idx + 1}</span>
                                    </span>
                                    <span className={styles.rankingName}>{player.name}</span>
                                    <span className={styles.rankingTeam}>
                                        {team ? (
                                            <span
                                                className={`${styles.teamBadge} ${styles[`teamBadge${team.tone}`]} ${styles.teamBadgeSmall}`}
                                            >
                                                {team.shortName}
                                            </span>
                                        ) : (
                                            '-'
                                        )}
                                    </span>
                                    <span
                                        className={`${styles.rankingStatCell} ${activeStat === 'goals' ? styles.rankingStatActive : ''
                                            }`}
                                    >
                                        {player.goals || 0}
                                    </span>
                                    <span
                                        className={`${styles.rankingStatCell} ${activeStat === 'assists' ? styles.rankingStatActive : ''
                                            }`}
                                    >
                                        {player.assists || 0}
                                    </span>
                                    {canManage && (
                                        <span className={styles.rankingActions}>
                                            <button
                                                type="button"
                                                className={styles.statBtn}
                                                onClick={() => handleStatChange(player.id, activeStat, -1)}
                                                aria-label={`${player.name} ${activeStat} 감소`}
                                                disabled={(player[activeStat] || 0) <= 0}
                                            >
                                                <Minus size={14} />
                                            </button>
                                            <button
                                                type="button"
                                                className={`${styles.statBtn} ${styles.statBtnPlus}`}
                                                onClick={() => handleStatChange(player.id, activeStat, 1)}
                                                aria-label={`${player.name} ${activeStat} 증가`}
                                            >
                                                <Plus size={14} />
                                            </button>
                                        </span>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {actionError ? <p className={styles.errorText}>{actionError}</p> : null}
            </article>
        </section>
    );
}
