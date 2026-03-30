import { orderBy } from 'firebase/firestore';
import { useCollection } from './useCollection';

export function usePlayers() {
  return useCollection('players', [orderBy('lastName')]);
}
