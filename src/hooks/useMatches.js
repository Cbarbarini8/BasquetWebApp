import { orderBy, where } from 'firebase/firestore';
import { useCollection } from './useCollection';

// Si no hay seasonId, no monta listener (evita traer TODOS los partidos de
// TODAS las temporadas en el primer frame, cuando seasons aun no cargo).
export function useMatches(seasonId) {
  const constraints = seasonId
    ? [where('seasonId', '==', seasonId), orderBy('round')]
    : [];
  return useCollection('matches', constraints, !!seasonId);
}
