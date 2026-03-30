import { orderBy, where } from 'firebase/firestore';
import { useCollection } from './useCollection';

export function useMatches(seasonId) {
  const constraints = seasonId
    ? [where('seasonId', '==', seasonId), orderBy('round')]
    : [orderBy('round')];

  return useCollection('matches', constraints);
}
