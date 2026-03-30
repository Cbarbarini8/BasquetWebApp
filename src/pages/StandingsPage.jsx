import { useState, useMemo } from 'react';
import { useStandings } from '../hooks/useStandings';
import { useSeasons } from '../hooks/useSeasons';
import PageShell from '../components/layout/PageShell';
import StandingsTable from '../components/standings/StandingsTable';
import SeasonSelector from '../components/common/SeasonSelector';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';

export default function StandingsPage() {
  const { data: seasons, loading: seasonsLoading } = useSeasons();
  const activeSeason = useMemo(() => seasons.find(s => s.active), [seasons]);
  const [selectedSeasonId, setSelectedSeasonId] = useState(null);

  const seasonId = selectedSeasonId || activeSeason?.id;
  const { data: standings, loading } = useStandings(seasonId);

  if (seasonsLoading || loading) return <PageShell><LoadingSpinner /></PageShell>;

  return (
    <PageShell title="Tabla de Posiciones">
      <div className="mb-4">
        <SeasonSelector
          seasons={seasons}
          selectedId={seasonId || ''}
          onChange={setSelectedSeasonId}
        />
      </div>

      {standings.length === 0 ? (
        <EmptyState message="No hay datos de posiciones todavia" />
      ) : (
        <StandingsTable standings={standings} />
      )}
    </PageShell>
  );
}
