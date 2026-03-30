import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useMatches } from './useMatches';
import { usePlayers } from './usePlayers';
import { useTeams } from './useTeams';
import { computePlayerStats } from '../lib/calculations';

export function usePlayerStats() {
  const { data: matches, loading: matchesLoading } = useMatches();
  const { data: players, loading: playersLoading } = usePlayers();
  const { data: teams, loading: teamsLoading } = useTeams();
  const [allEvents, setAllEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  useEffect(() => {
    if (matchesLoading || matches.length === 0) {
      setEventsLoading(false);
      return;
    }

    const relevantMatches = matches.filter(m => m.status === 'live' || m.status === 'finished');
    if (relevantMatches.length === 0) {
      setAllEvents([]);
      setEventsLoading(false);
      return;
    }

    const unsubscribes = [];
    const eventsByMatch = {};
    let initialLoadCount = 0;

    relevantMatches.forEach(match => {
      const eventsRef = collection(db, `matches/${match.id}/events`);
      const q = query(eventsRef, orderBy('timestamp', 'desc'));

      const unsub = onSnapshot(q, (snapshot) => {
        eventsByMatch[match.id] = snapshot.docs.map(doc => ({
          id: doc.id,
          matchId: match.id,
          ...doc.data(),
        }));

        const flat = Object.values(eventsByMatch).flat();
        setAllEvents(flat);

        initialLoadCount++;
        if (initialLoadCount >= relevantMatches.length) {
          setEventsLoading(false);
        }
      });

      unsubscribes.push(unsub);
    });

    return () => unsubscribes.forEach(u => u());
  }, [matches, matchesLoading]);

  const stats = useMemo(() => {
    if (playersLoading || teamsLoading || eventsLoading) return [];
    return computePlayerStats(allEvents, players, teams);
  }, [allEvents, players, teams, playersLoading, teamsLoading, eventsLoading]);

  return {
    data: stats,
    loading: matchesLoading || playersLoading || teamsLoading || eventsLoading,
  };
}
