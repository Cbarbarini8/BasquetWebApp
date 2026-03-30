import { orderBy } from 'firebase/firestore';
import { useCollection } from './useCollection';

export function useCourts() {
  return useCollection('courts', [orderBy('name')]);
}
