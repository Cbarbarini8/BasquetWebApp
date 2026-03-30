import { useState, useMemo } from 'react';
import { usePlayerStats } from '../hooks/usePlayerStats';
import { useTeams } from '../hooks/useTeams';
import { useSeasons } from '../hooks/useSeasons';
import PageShell from '../components/layout/PageShell';
import StatsTable from '../components/stats/StatsTable';
import SeasonSelector from '../components/common/SeasonSelector';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';

export default function StatsPage() {
  const { data: seasons, loading: seasonsLoading } = useSeasons();
  const activeSeason = useMemo(() => seasons.find(s => s.active), [seasons]);
  const [selectedSeasonId, setSelectedSeasonId] = useState(null);

  const seasonId = selectedSeasonId || activeSeason?.id;
  const { data: stats, loading: statsLoading } = usePlayerStats(seasonId);
  const { data: teams, loading: teamsLoading } = useTeams();

  if (seasonsLoading || statsLoading || teamsLoading) return <PageShell><LoadingSpinner /></PageShell>;

  return (
    <PageShell title="Estadisticas de Jugadores">
      <div className="mb-4">
        <SeasonSelector
          seasons={seasons}
          selectedId={seasonId || ''}
          onChange={setSelectedSeasonId}
        />
      </div>

      {stats.length === 0 ? (
        <EmptyState message="No hay estadisticas disponibles todavia" />
      ) : (
        <StatsTable stats={stats} teams={teams} />
      )}
    </PageShell>
  );
}
