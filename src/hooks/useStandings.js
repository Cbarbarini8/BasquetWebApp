import { useMemo } from 'react';
import { useMatches } from './useMatches';
import { useTeams } from './useTeams';
import { computeStandings } from '../lib/calculations';

// La tabla de posiciones de la temporada cuenta SOLO los partidos de fase
// regular. Los partidos de playoff (play-in/play-off/semifinal/final) son
// eliminatorios y no aportan al ranking — si no filtramos, ganar un play-in
// "sube" un equipo en la tabla y diverge del seeding congelado en
// season.playoffSeeds (ver lib/playoffs.js).
//
// Matches sin campo `phase` (datos legacy / temporadas anteriores al feature)
// se asumen regulares.
export function useStandings(seasonId) {
  const { data: matches, loading: matchesLoading } = useMatches(seasonId);
  const { data: teams, loading: teamsLoading } = useTeams();

  const standings = useMemo(() => {
    if (matchesLoading || teamsLoading) return [];
    const regular = matches.filter(m => !m.phase || m.phase === 'regular');
    return computeStandings(regular, teams);
  }, [matches, teams, matchesLoading, teamsLoading]);

  return {
    data: standings,
    loading: matchesLoading || teamsLoading,
  };
}
