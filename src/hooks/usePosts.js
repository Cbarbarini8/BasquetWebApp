import { orderBy } from 'firebase/firestore';
import { useCollection } from './useCollection';

export function usePosts() {
  return useCollection('posts', [orderBy('createdAt', 'desc')]);
}
