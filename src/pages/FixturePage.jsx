import { useMemo } from 'react';
import { useMatches } from '../hooks/useMatches';
import { useTeams } from '../hooks/useTeams';
import PageShell from '../components/layout/PageShell';
import RoundGroup from '../components/fixture/RoundGroup';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';

export default function FixturePage() {
  const { data: matches, loading: matchesLoading } = useMatches();
  const { data: teams, loading: teamsLoading } = useTeams();

  const teamsMap = useMemo(() => {
    const map = {};
    teams.forEach(t => { map[t.id] = t; });
    return map;
  }, [teams]);

  const { liveMatches, rounds } = useMemo(() => {
    const live = matches.filter(m => m.status === 'live');
    const grouped = {};
    matches.forEach(m => {
      const r = m.round || 1;
      if (!grouped[r]) grouped[r] = [];
      grouped[r].push(m);
    });
    const roundNumbers = Object.keys(grouped).map(Number).sort((a, b) => a - b);
    return {
      liveMatches: live,
      rounds: roundNumbers.map(r => ({ round: r, matches: grouped[r] })),
    };
  }, [matches]);

  if (matchesLoading || teamsLoading) return <PageShell><LoadingSpinner /></PageShell>;

  return (
    <PageShell title="Fixture">
      {matches.length === 0 ? (
        <EmptyState message="No hay partidos cargados todavia" />
      ) : (
        <>
          {liveMatches.length > 0 && (
            <div className="mb-8">
              <h2
                className="text-sm font-bold uppercase tracking-wider mb-3 px-1 flex items-center gap-2"
                style={{ color: 'var(--color-live)' }}
              >
                <span className="w-2 h-2 rounded-full animate-pulse-live" style={{ backgroundColor: 'var(--color-live)' }} />
                En Vivo
              </h2>
              <div className="space-y-2">
                {liveMatches.map(match => (
                  <div key={`live-${match.id}`}>
                    <RoundGroup
                      round={null}
                      matches={[match]}
                      teamsMap={teamsMap}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {rounds.map(({ round, matches: roundMatches }) => (
            <RoundGroup
              key={round}
              round={round}
              matches={roundMatches}
              teamsMap={teamsMap}
            />
          ))}
        </>
      )}
    </PageShell>
  );
}
