import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, orderBy, query, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useMatches } from './useMatches';
import { usePlayers } from './usePlayers';
import { useTeams } from './useTeams';
import { computePlayerStats } from '../lib/calculations';

// Estrategia de lecturas para reducir consumo Firestore:
// - live: onSnapshot por partido (tiempo real necesario)
// - finished: getDocs una sola vez (no cambian en condiciones normales; si un admin
//   edita stats de un partido finalizado, el publico vera los cambios al recargar)
// Las deps usan claves de IDs ordenados, no el array matches, para no re-suscribir
// cuando solo cambian campos volatiles del match (clockRemainingMs, homeScore, etc.).

export function usePlayerStats(seasonId) {
  const { data: matches, loading: matchesLoading } = useMatches(seasonId);
  const { data: players, loading: playersLoading } = usePlayers();
  const { data: teams, loading: teamsLoading } = useTeams();
  const [eventsByMatch, setEventsByMatch] = useState({});
  const [liveLoading, setLiveLoading] = useState(true);
  const [finishedLoading, setFinishedLoading] = useState(true);

  const liveIdsKey = useMemo(
    () => matches.filter(m => m.status === 'live').map(m => m.id).sort().join(','),
    [matches]
  );
  const finishedIdsKey = useMemo(
    () => matches.filter(m => m.status === 'finished').map(m => m.id).sort().join(','),
    [matches]
  );

  useEffect(() => {
    if (matchesLoading) return;
    const ids = liveIdsKey ? liveIdsKey.split(',').filter(Boolean) : [];
    if (ids.length === 0) {
      setLiveLoading(false);
      return;
    }
    const unsubs = ids.map(matchId => {
      const q = query(collection(db, `matches/${matchId}/events`), orderBy('timestamp', 'desc'));
      return onSnapshot(q, snapshot => {
        const events = snapshot.docs.map(doc => ({
          id: doc.id,
          matchId,
          ...doc.data(),
        }));
        setEventsByMatch(prev => ({ ...prev, [matchId]: events }));
        setLiveLoading(false);
      });
    });
    return () => unsubs.forEach(u => u());
  }, [liveIdsKey, matchesLoading]);

  useEffect(() => {
    if (matchesLoading) return;
    const ids = finishedIdsKey ? finishedIdsKey.split(',').filter(Boolean) : [];
    if (ids.length === 0) {
      setFinishedLoading(false);
      return;
    }
    let cancelled = false;
    setFinishedLoading(true);
    (async () => {
      const entries = await Promise.all(ids.map(async matchId => {
        const q = query(collection(db, `matches/${matchId}/events`), orderBy('timestamp', 'desc'));
        const snapshot = await getDocs(q);
        return [matchId, snapshot.docs.map(doc => ({
          id: doc.id,
          matchId,
          ...doc.data(),
        }))];
      }));
      if (cancelled) return;
      setEventsByMatch(prev => {
        const next = { ...prev };
        entries.forEach(([matchId, events]) => { next[matchId] = events; });
        return next;
      });
      setFinishedLoading(false);
    })();
    return () => { cancelled = true; };
  }, [finishedIdsKey, matchesLoading]);

  // Limpia entries de partidos que salieron del set relevante (cambio de temporada,
  // match eliminado, etc.) para no inflar eventsByMatch indefinidamente.
  useEffect(() => {
    const relevantIds = new Set([
      ...(liveIdsKey ? liveIdsKey.split(',').filter(Boolean) : []),
      ...(finishedIdsKey ? finishedIdsKey.split(',').filter(Boolean) : []),
    ]);
    setEventsByMatch(prev => {
      let changed = false;
      const next = {};
      Object.entries(prev).forEach(([mid, evs]) => {
        if (relevantIds.has(mid)) next[mid] = evs;
        else changed = true;
      });
      return changed ? next : prev;
    });
  }, [liveIdsKey, finishedIdsKey]);

  const allEvents = useMemo(() => Object.values(eventsByMatch).flat(), [eventsByMatch]);

  const stats = useMemo(() => {
    if (playersLoading || teamsLoading || liveLoading || finishedLoading) return [];
    return computePlayerStats(allEvents, players, teams);
  }, [allEvents, players, teams, playersLoading, teamsLoading, liveLoading, finishedLoading]);

  return {
    data: stats,
    loading: matchesLoading || playersLoading || teamsLoading || liveLoading || finishedLoading,
  };
}
