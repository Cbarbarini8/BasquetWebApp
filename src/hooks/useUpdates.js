import { orderBy } from 'firebase/firestore';
import { useCollection } from './useCollection';

export function useUpdates() {
  return useCollection('updates', [orderBy('publishedAt', 'desc')]);
}
