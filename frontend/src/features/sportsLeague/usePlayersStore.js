/**
 * @file src/features/sportsLeague/usePlayersStore.js
 * @description API-backed player roster store for sports league lineup/ranking tabs.
 */

import { useCallback, useEffect, useState } from 'react';

import { sportsLeagueApi } from '../../api/sportsLeague';

export default function usePlayersStore(categoryId) {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadPlayers() {
      if (!categoryId) {
        if (!active) return;
        setPlayers([]);
        setError('');
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const result = await sportsLeagueApi.getPlayers(categoryId);
        // Guard against late async resolution after category changes or unmount.
        if (!active) return;
        setPlayers(result.players || []);
        setError('');
      } catch (issue) {
        if (!active) return;
        setPlayers([]);
        setError(issue?.message || '선수 데이터를 불러오지 못했습니다.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadPlayers();

    return () => {
      active = false;
    };
  }, [categoryId]);

  const addPlayer = useCallback(
    async (teamId, name) => {
      if (!categoryId || !teamId || !name?.trim()) return null;
      try {
        const result = await sportsLeagueApi.createPlayer(categoryId, teamId, {
          name: name.trim(),
        });
        // Treat the backend roster payload as authoritative instead of patching local state manually.
        setPlayers(result.players || []);
        setError('');
        return result.player || null;
      } catch (issue) {
        setError(issue?.message || '선수 추가에 실패했습니다.');
        throw issue;
      }
    },
    [categoryId]
  );

  const removePlayer = useCallback(
    async (playerId) => {
      if (!categoryId || !playerId) return;
      try {
        const result = await sportsLeagueApi.deletePlayer(categoryId, playerId);
        setPlayers(result.players || []);
        setError('');
      } catch (issue) {
        setError(issue?.message || '선수 삭제에 실패했습니다.');
        throw issue;
      }
    },
    [categoryId]
  );

  const incrementStat = useCallback(
    async (playerId, stat) => {
      if (!categoryId || !playerId) return null;
      try {
        const result = await sportsLeagueApi.adjustPlayerStat(categoryId, playerId, {
          stat,
          delta: 1,
        });
        setPlayers(result.players || []);
        setError('');
        return result.player || null;
      } catch (issue) {
        setError(issue?.message || '선수 기록 수정에 실패했습니다.');
        throw issue;
      }
    },
    [categoryId]
  );

  const decrementStat = useCallback(
    async (playerId, stat) => {
      if (!categoryId || !playerId) return null;
      try {
        const result = await sportsLeagueApi.adjustPlayerStat(categoryId, playerId, {
          stat,
          delta: -1,
        });
        setPlayers(result.players || []);
        setError('');
        return result.player || null;
      } catch (issue) {
        setError(issue?.message || '선수 기록 수정에 실패했습니다.');
        throw issue;
      }
    },
    [categoryId]
  );

  return {
    players,
    loading,
    error,
    addPlayer,
    removePlayer,
    incrementStat,
    decrementStat,
  };
}
