import { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTeams } from '../hooks/useTeams';
import { usePlayers } from '../hooks/usePlayers';
import { useMatches } from '../hooks/useMatches';
import PageShell from '../components/layout/PageShell';
import TeamForm from '../components/admin/TeamForm';
import PlayerForm from '../components/admin/PlayerForm';
import FixtureGenerator from '../components/admin/FixtureGenerator';
import MatchManager from '../components/admin/MatchManager';
import LoadingSpinner from '../components/common/LoadingSpinner';

const TABS = [
  { id: 'teams', label: 'Equipos' },
  { id: 'players', label: 'Jugadores' },
  { id: 'fixture', label: 'Fixture' },
  { id: 'matches', label: 'Partidos' },
];

export default function AdminDashboard() {
  const { logout } = useAuth();
  const { data: teams, loading: teamsLoading } = useTeams();
  const { data: players, loading: playersLoading } = usePlayers();
  const { data: matches, loading: matchesLoading } = useMatches();
  const [activeTab, setActiveTab] = useState('teams');

  const teamsMap = useMemo(() => {
    const map = {};
    teams.forEach(t => { map[t.id] = t; });
    return map;
  }, [teams]);

  const loading = teamsLoading || playersLoading || matchesLoading;

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
          {activeTab === 'teams' && <TeamForm teams={teams} />}
          {activeTab === 'players' && <PlayerForm players={players} teams={teams} />}
          {activeTab === 'fixture' && <FixtureGenerator teams={teams} matches={matches} />}
          {activeTab === 'matches' && <MatchManager matches={matches} teamsMap={teamsMap} />}
        </>
      )}
    </PageShell>
  );
}
