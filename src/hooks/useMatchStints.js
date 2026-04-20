import { useCollection } from './useCollection';

// El caller debe pasar un matchId valido (de lo contrario useCollection falla).
// Ver componentes que lo usan: todos ya tienen match cargado antes de invocar.
export function useMatchStints(matchId) {
  return useCollection(`matches/${matchId}/playerStints`, []);
}
