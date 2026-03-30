import { usePlayerStats } from '../hooks/usePlayerStats';
import { useTeams } from '../hooks/useTeams';
import PageShell from '../components/layout/PageShell';
import StatsTable from '../components/stats/StatsTable';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';

export default function StatsPage() {
  const { data: stats, loading: statsLoading } = usePlayerStats();
  const { data: teams, loading: teamsLoading } = useTeams();

  if (statsLoading || teamsLoading) return <PageShell><LoadingSpinner /></PageShell>;

  return (
    <PageShell title="Estadisticas de Jugadores">
      {stats.length === 0 ? (
        <EmptyState message="No hay estadisticas disponibles todavia" />
      ) : (
        <StatsTable stats={stats} teams={teams} />
      )}
    </PageShell>
  );
}
