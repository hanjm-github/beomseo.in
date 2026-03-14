/**
 * @file src/features/sportsLeague/useSportsLeagueLive.js
 * @description Hook for loading and subscribing to sports league live text data.
 */

import { useCallback, useEffect, useState } from 'react';
import { sportsLeagueApi } from '../../api/sportsLeague';

export default function useSportsLeagueLive(categoryId) {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};

    // Load the current snapshot first so the page can render even if the stream handshake is delayed.
    sportsLeagueApi
      .getCategory(categoryId)
      .then((nextSnapshot) => {
        if (!active) return;
        setSnapshot(nextSnapshot);
        setError('');
        unsubscribe = sportsLeagueApi.subscribe(categoryId, (streamSnapshot) => {
          if (!active) return;
          setSnapshot(streamSnapshot);
        });
      })
      .catch((nextError) => {
        if (!active) return;
        setError(nextError?.message || '문자중계 데이터를 불러오지 못했습니다.');
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [categoryId]);

  const createEvent = useCallback(
    async (payload) => {
      const result = await sportsLeagueApi.createEvent(categoryId, payload);
      setSnapshot(result.snapshot);
      return result;
    },
    [categoryId]
  );

  const updateEvent = useCallback(
    async (eventId, payload) => {
      const result = await sportsLeagueApi.updateEvent(categoryId, eventId, payload);
      setSnapshot(result.snapshot);
      return result;
    },
    [categoryId]
  );

  const deleteEvent = useCallback(
    async (eventId) => {
      const result = await sportsLeagueApi.deleteEvent(categoryId, eventId);
      setSnapshot(result.snapshot);
      return result;
    },
    [categoryId]
  );

  const updateMatchParticipants = useCallback(
    async (matchId, payload) => {
      const result = await sportsLeagueApi.updateMatchParticipants(categoryId, matchId, payload);
      setSnapshot(result.snapshot);
      return result;
    },
    [categoryId]
  );

  return {
    snapshot,
    loading,
    error,
    createEvent,
    updateEvent,
    deleteEvent,
    updateMatchParticipants,
  };
}
