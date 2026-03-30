import { orderBy } from 'firebase/firestore';
import { useCollection } from './useCollection';

export function useTeams() {
  return useCollection('teams', [orderBy('name')]);
}
