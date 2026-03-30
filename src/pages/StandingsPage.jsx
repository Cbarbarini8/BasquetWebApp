import { useStandings } from '../hooks/useStandings';
import PageShell from '../components/layout/PageShell';
import StandingsTable from '../components/standings/StandingsTable';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';

export default function StandingsPage() {
  const { data: standings, loading } = useStandings();

  if (loading) return <PageShell><LoadingSpinner /></PageShell>;

  return (
    <PageShell title="Tabla de Posiciones">
      {standings.length === 0 ? (
        <EmptyState message="No hay datos de posiciones todavia" />
      ) : (
        <StandingsTable standings={standings} />
      )}
    </PageShell>
  );
}
