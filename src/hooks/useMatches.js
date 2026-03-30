import { orderBy } from 'firebase/firestore';
import { useCollection } from './useCollection';

export function useMatches() {
  return useCollection('matches', [orderBy('round'), orderBy('scheduledDate')]);
}
