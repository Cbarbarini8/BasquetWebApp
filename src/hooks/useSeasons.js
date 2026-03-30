import { orderBy } from 'firebase/firestore';
import { useCollection } from './useCollection';

export function useSeasons() {
  return useCollection('seasons', [orderBy('createdAt', 'desc')]);
}
