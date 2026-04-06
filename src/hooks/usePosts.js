import { useCollection } from './useCollection';

export function usePosts() {
  // No orderBy constraint - sorting handled client-side to support posts without 'order' field
  return useCollection('posts');
}
