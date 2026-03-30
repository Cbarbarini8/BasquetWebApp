import { useMemo } from 'react';
import { useMatches } from './useMatches';
import { useTeams } from './useTeams';
import { computeStandings } from '../lib/calculations';

export function useStandings() {
  const { data: matches, loading: matchesLoading } = useMatches();
  const { data: teams, loading: teamsLoading } = useTeams();

  const standings = useMemo(() => {
    if (matchesLoading || teamsLoading) return [];
    return computeStandings(matches, teams);
  }, [matches, teams, matchesLoading, teamsLoading]);

  return {
    data: standings,
    loading: matchesLoading || teamsLoading,
  };
}
