import { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTeams } from '../hooks/useTeams';
import { usePlayers } from '../hooks/usePlayers';
import { useMatches } from '../hooks/useMatches';
import { useSeasons } from '../hooks/useSeasons';
import { useCourts } from '../hooks/useCourts';
import PageShell from '../components/layout/PageShell';
import TeamForm from '../components/admin/TeamForm';
import PlayerForm from '../components/admin/PlayerForm';
import FixtureGenerator from '../components/admin/FixtureGenerator';
import MatchManager from '../components/admin/MatchManager';
import SeasonForm from '../components/admin/SeasonForm';
import CourtForm from '../components/admin/CourtForm';
import LoadingSpinner from '../components/common/LoadingSpinner';

const TABS = [
  { id: 'seasons', label: 'Temporadas' },
  { id: 'teams', label: 'Equipos' },
  { id: 'players', label: 'Jugadores' },
  { id: 'courts', label: 'Canchas' },
  { id: 'fixture', label: 'Fixture' },
  { id: 'matches', label: 'Partidos' },
];

export default function AdminDashboard() {
  const { logout } = useAuth();
  const { data: teams, loading: teamsLoading } = useTeams();
  const { data: players, loading: playersLoading } = usePlayers();
  const { data: seasons, loading: seasonsLoading } = useSeasons();
  const { data: courts, loading: courtsLoading } = useCourts();
  const [activeTab, setActiveTab] = useState('seasons');

  const activeSeason = useMemo(() => seasons.find(s => s.active) || null, [seasons]);

  const { data: matches, loading: matchesLoading } = useMatches(activeSeason?.id);

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

  const loading = teamsLoading || playersLoading || matchesLoading || seasonsLoading || courtsLoading;

  return (
    <PageShell>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
          Panel de Administracion
        </h1>
        <button
          onClick={logout}
          className="text-sm px-3 py-1.5 rounded-md"
          style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
        >
          Cerrar sesion
        </button>
      </div>

      {activeSeason && (
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
          Temporada activa: <strong style={{ color: 'var(--color-primary)' }}>{activeSeason.name}</strong>
        </p>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap"
            style={{
              backgroundColor: activeTab === tab.id ? 'var(--color-primary)' : 'transparent',
              color: activeTab === tab.id ? '#ffffff' : 'var(--color-text-secondary)',
              border: activeTab === tab.id ? 'none' : '1px solid var(--color-border)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          {activeTab === 'seasons' && <SeasonForm seasons={seasons} />}
          {activeTab === 'teams' && <TeamForm teams={teams} />}
          {activeTab === 'players' && <PlayerForm players={players} teams={teams} />}
          {activeTab === 'courts' && <CourtForm courts={courts} />}
          {activeTab === 'fixture' && <FixtureGenerator teams={teams} matches={matches} activeSeason={activeSeason} />}
          {activeTab === 'matches' && <MatchManager matches={matches} teamsMap={teamsMap} teams={teams} courts={courts} courtsMap={courtsMap} seasonId={activeSeason?.id} />}
        </>
      )}
    </PageShell>
  );
}
