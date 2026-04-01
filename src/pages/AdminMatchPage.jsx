import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDocument } from '../hooks/useDocument';
import { useMatchEvents } from '../hooks/useMatchEvents';
import { useTeams } from '../hooks/useTeams';
import { usePlayers } from '../hooks/usePlayers';
import PageShell from '../components/layout/PageShell';
import LiveScoring from '../components/admin/LiveScoring';
import LoadingSpinner from '../components/common/LoadingSpinner';

export default function AdminMatchPage() {
  const { matchId } = useParams();
  const { user, canEdit } = useAuth();
  const { data: match, loading: matchLoading } = useDocument(`matches/${matchId}`);
  const { data: events, loading: eventsLoading } = useMatchEvents(matchId);
  const { data: teams, loading: teamsLoading } = useTeams();
  const { data: allPlayers, loading: playersLoading } = usePlayers();

  const { homeTeam, awayTeam, homePlayers, awayPlayers } = useMemo(() => {
    if (!match) return { homeTeam: null, awayTeam: null, homePlayers: [], awayPlayers: [] };
    return {
      homeTeam: teams.find(t => t.id === match.homeTeamId),
      awayTeam: teams.find(t => t.id === match.awayTeamId),
      homePlayers: allPlayers.filter(p => p.teamId === match.homeTeamId).sort((a, b) => a.number - b.number),
      awayPlayers: allPlayers.filter(p => p.teamId === match.awayTeamId).sort((a, b) => a.number - b.number),
    };
  }, [match, teams, allPlayers]);

  const loading = matchLoading || eventsLoading || teamsLoading || playersLoading;

  if (loading) return <PageShell><LoadingSpinner /></PageShell>;

  if (!match) {
    return (
      <PageShell>
        <p style={{ color: 'var(--color-text-secondary)' }}>Partido no encontrado</p>
        <Link to="/admin" className="text-sm underline" style={{ color: 'var(--color-primary)' }}>Volver al admin</Link>
      </PageShell>
    );
  }

  if (match.status !== 'live') {
    return (
      <PageShell>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          Este partido no esta en vivo. Estado actual: <strong>{match.status}</strong>
        </p>
        <Link to="/admin" className="text-sm underline" style={{ color: 'var(--color-primary)' }}>Volver al admin</Link>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="mb-4">
        <Link to="/admin" className="text-sm" style={{ color: 'var(--color-primary)' }}>
          &larr; Volver al admin
        </Link>
      </div>
      <LiveScoring
        match={match}
        events={events}
        homePlayers={homePlayers}
        awayPlayers={awayPlayers}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        canEdit={canEdit('scoring')}
        user={user}
      />
    </PageShell>
  );
}
