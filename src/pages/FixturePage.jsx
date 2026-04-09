import { useState, useMemo } from 'react';
import { useMatches } from '../hooks/useMatches';
import { useTeams } from '../hooks/useTeams';
import { useSeasons } from '../hooks/useSeasons';
import { useCourts } from '../hooks/useCourts';
import PageShell from '../components/layout/PageShell';
import RoundGroup from '../components/fixture/RoundGroup';
import SeasonSelector from '../components/common/SeasonSelector';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import { getMatchProximityToNow } from '../lib/utils';

export default function FixturePage() {
  const { data: seasons, loading: seasonsLoading } = useSeasons();
  const activeSeason = useMemo(() => seasons.find(s => s.active), [seasons]);
  const [selectedSeasonId, setSelectedSeasonId] = useState(null);
  const [selectedRound, setSelectedRound] = useState('all');

  const seasonId = selectedSeasonId || activeSeason?.id;
  const { data: matches, loading: matchesLoading } = useMatches(seasonId);
  const { data: teams, loading: teamsLoading } = useTeams();
  const { data: courts, loading: courtsLoading } = useCourts();

  const teamsMap = useMemo(() => {
    const map = {};
    teams.forEach(t => { map[t.id] = t; });
    return map;
  }, [teams]);

  const courtsMap = useMemo(() => {
    const map = {};
    courts.forEach(c => { map[c.id] = c; });
    return map;
  }, [courts]);

  const { liveMatches, pendingRounds, completedRounds, roundNumbers } = useMemo(() => {
    const live = matches.filter(m => m.status === 'live');
    const grouped = {};
    matches.forEach(m => {
      const r = m.round || 1;
      if (!grouped[r]) grouped[r] = [];
      grouped[r].push(m);
    });
    const nums = Object.keys(grouped).map(Number).sort((a, b) => b - a);
    const pending = [];
    const completed = [];
    nums.forEach(r => {
      const roundMatches = grouped[r];
      const allFinished = roundMatches.every(m => m.status === 'finished');
      const entry = { round: r, matches: roundMatches };
      if (allFinished) completed.push(entry);
      else pending.push(entry);
    });

    // Ordenar pendientes por proximidad a hoy: la fecha con el partido mas cercano primero
    const now = Date.now();
    const getRoundProximity = (roundMatches) => {
      let minDistance = Infinity;
      roundMatches.forEach(m => {
        const d = getMatchProximityToNow(m, now);
        if (d < minDistance) minDistance = d;
      });
      return minDistance;
    };
    pending.sort((a, b) => getRoundProximity(a.matches) - getRoundProximity(b.matches));

    return {
      liveMatches: live,
      pendingRounds: pending,
      completedRounds: completed,
      roundNumbers: nums,
    };
  }, [matches]);

  const filteredPending = useMemo(() => {
    if (selectedRound === 'all') return pendingRounds;
    const num = parseInt(selectedRound);
    return pendingRounds.filter(r => r.round === num);
  }, [pendingRounds, selectedRound]);

  const filteredCompleted = useMemo(() => {
    if (selectedRound === 'all') return completedRounds;
    const num = parseInt(selectedRound);
    return completedRounds.filter(r => r.round === num);
  }, [completedRounds, selectedRound]);

  const currentSeason = useMemo(() => seasons.find(s => s.id === seasonId), [seasons, seasonId]);

  if (seasonsLoading || matchesLoading || teamsLoading || courtsLoading) return <PageShell><LoadingSpinner /></PageShell>;

  return (
    <PageShell title="Fixture">
      {currentSeason && (
        <div className="flex items-center gap-3 mb-4">
          {currentSeason.imageUrl && (
            <img src={currentSeason.imageUrl} alt={currentSeason.name} className="w-12 h-12 rounded object-cover shrink-0" />
          )}
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
            {currentSeason.name}
          </h2>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <SeasonSelector
          seasons={seasons}
          selectedId={seasonId || ''}
          onChange={setSelectedSeasonId}
        />

        {roundNumbers.length > 0 && (
          <select
            value={selectedRound}
            onChange={e => setSelectedRound(e.target.value)}
            className="px-3 py-2 rounded-md text-sm font-medium"
            style={{
              backgroundColor: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
            }}
          >
            <option value="all">Todas las fechas</option>
            {roundNumbers.map(r => (
              <option key={r} value={r}>Fecha {r}</option>
            ))}
          </select>
        )}
      </div>

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
                      courtsMap={courtsMap}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {filteredPending.map(({ round, matches: roundMatches }) => (
            <RoundGroup
              key={`pending-${round}`}
              round={round}
              matches={roundMatches}
              teamsMap={teamsMap}
              courtsMap={courtsMap}
              ascending
            />
          ))}

          {filteredCompleted.length > 0 && (
            <>
              <h2
                className="text-xs font-bold uppercase tracking-widest mt-8 mb-4 pb-2 px-1"
                style={{
                  color: 'var(--color-text-muted)',
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                Fechas completadas
              </h2>
              {filteredCompleted.map(({ round, matches: roundMatches }) => (
                <RoundGroup
                  key={`completed-${round}`}
                  round={round}
                  matches={roundMatches}
                  teamsMap={teamsMap}
                  courtsMap={courtsMap}
                />
              ))}
            </>
          )}
        </>
      )}
    </PageShell>
  );
}
