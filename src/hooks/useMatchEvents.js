import { orderBy } from 'firebase/firestore';
import { useCollection } from './useCollection';

export function useMatchEvents(matchId) {
  const path = matchId ? `matches/${matchId}/events` : null;
  const { data, loading, error } = useCollection(
    path || 'matches/__none__/events',
    [orderBy('timestamp', 'desc')]
  );

  return {
    data: matchId ? data : [],
    loading: matchId ? loading : false,
    error,
  };
}
