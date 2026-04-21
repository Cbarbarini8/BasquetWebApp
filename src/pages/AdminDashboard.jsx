import { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTeams } from '../hooks/useTeams';
import { usePlayers } from '../hooks/usePlayers';
import { useMatches } from '../hooks/useMatches';
import { useSeasons } from '../hooks/useSeasons';
import { useCourts } from '../hooks/useCourts';
import { usePosts } from '../hooks/usePosts';
import PageShell from '../components/layout/PageShell';
import TeamForm from '../components/admin/TeamForm';
import PlayerForm from '../components/admin/PlayerForm';
import FixtureGenerator from '../components/admin/FixtureGenerator';
import MatchManager from '../components/admin/MatchManager';
import ScoringToday from '../components/admin/ScoringToday';
import SeasonForm from '../components/admin/SeasonForm';
import CourtForm from '../components/admin/CourtForm';
import PostManager from '../components/admin/PostManager';
import UpdatesManager from '../components/admin/UpdatesManager';
import UserManager from '../components/admin/UserManager';
import AuditLog from '../components/admin/AuditLog';
import SettingsManager from '../components/admin/SettingsManager';
import LoadingSpinner from '../components/common/LoadingSpinner';

const ALL_TABS = [
  { id: 'seasons', label: 'Temporadas', permission: 'seasons' },
  { id: 'teams', label: 'Equipos', permission: 'teams' },
  { id: 'players', label: 'Jugadores', permission: 'players' },
  { id: 'courts', label: 'Canchas', permission: 'courts' },
  { id: 'fixture', label: 'Fixture', permission: 'fixture' },
  { id: 'matches', label: 'Partidos', permission: 'matches' },
  { id: 'scoring', label: 'Planilla en vivo', permission: 'scoring' },
  { id: 'posts', label: 'Instagram', permission: 'posts' },
  { id: 'updates', label: 'Actualizaciones', permission: 'updates' },
  { id: 'settings', label: 'Ajustes', ownerOnly: true },
  { id: 'users', label: 'Usuarios', ownerOnly: true },
  { id: 'audit', label: 'Auditoria', ownerOnly: true },
];

// Cada tab "pesada" monta sus hooks adentro: al cambiar de tab, el wrapper se
// desmonta y sus listeners se cierran. Tabs que solo usan datos cuasi-estaticos
// (teams/courts/seasons, ya compartidos via DataProvider) reciben props directo.

function PlayersTab({ canEdit, user, teams }) {
  const { data: players, loading } = usePlayers();
  if (loading) return <LoadingSpinner />;
  return <PlayerForm players={players} teams={teams} canEdit={canEdit} user={user} />;
}

function FixtureTab({ canEdit, user, teams, activeSeason }) {
  const { data: matches, loading } = useMatches(activeSeason?.id);
  if (loading) return <LoadingSpinner />;
  return <FixtureGenerator teams={teams} matches={matches} activeSeason={activeSeason} canEdit={canEdit} user={user} />;
}

function MatchesTab({ canEdit, canScoring, user, teams, courts, activeSeason }) {
  const { data: players, loading: playersLoading } = usePlayers();
  const { data: matches, loading: matchesLoading } = useMatches(activeSeason?.id);
  const teamsMap = useMemo(() => Object.fromEntries(teams.map(t => [t.id, t])), [teams]);
  const courtsMap = useMemo(() => Object.fromEntries(courts.map(c => [c.id, c])), [courts]);
  if (playersLoading || matchesLoading) return <LoadingSpinner />;
  return (
    <MatchManager
      matches={matches}
      teamsMap={teamsMap}
      teams={teams}
      players={players}
      courts={courts}
      courtsMap={courtsMap}
      seasonId={activeSeason?.id}
      canEdit={canEdit}
      canScoring={canScoring}
      user={user}
    />
  );
}

function ScoringTab({ canEdit, user, teams, courts, activeSeason }) {
  const { data: players, loading: playersLoading } = usePlayers();
  const { data: matches, loading: matchesLoading } = useMatches(activeSeason?.id);
  const teamsMap = useMemo(() => Object.fromEntries(teams.map(t => [t.id, t])), [teams]);
  const courtsMap = useMemo(() => Object.fromEntries(courts.map(c => [c.id, c])), [courts]);
  if (playersLoading || matchesLoading) return <LoadingSpinner />;
  return (
    <ScoringToday
      matches={matches}
      teamsMap={teamsMap}
      courtsMap={courtsMap}
      players={players}
      canEdit={canEdit}
      user={user}
    />
  );
}

function PostsTab({ canEdit, user }) {
  const { data: posts, loading } = usePosts();
  if (loading) return <LoadingSpinner />;
  return <PostManager posts={posts} canEdit={canEdit} user={user} />;
}

export default function AdminDashboard() {
  const { user, userDoc, logout, isOwner, canView, canEdit } = useAuth();
  const { data: teams, loading: teamsLoading } = useTeams();
  const { data: seasons, loading: seasonsLoading } = useSeasons();
  const { data: courts, loading: courtsLoading } = useCourts();

  const activeSeason = useMemo(() => seasons.find(s => s.active) || null, [seasons]);

  const visibleTabs = useMemo(() => {
    return ALL_TABS.filter(tab => {
      if (tab.ownerOnly) return isOwner;
      return canView(tab.permission);
    });
  }, [isOwner, canView]);

  const [activeTab, setActiveTab] = useState(null);
  const currentTab = activeTab || visibleTabs[0]?.id;

  const loading = teamsLoading || seasonsLoading || courtsLoading;

  return (
    <PageShell>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
          Panel de Administracion
        </h1>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
              {userDoc?.displayName || userDoc?.email || user?.email}
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {isOwner ? 'Propietario' : 'Administrador'}
            </p>
          </div>
          <button
            onClick={logout}
            className="text-sm px-3 py-1.5 rounded-md"
            style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
          >
            Salir
          </button>
        </div>
      </div>

      {activeSeason && (
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
          Temporada activa: <strong style={{ color: 'var(--color-primary)' }}>{activeSeason.name}</strong>
        </p>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto">
        {visibleTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap"
            style={{
              backgroundColor: currentTab === tab.id ? 'var(--color-primary)' : 'transparent',
              color: currentTab === tab.id ? '#ffffff' : 'var(--color-text-secondary)',
              border: currentTab === tab.id ? 'none' : '1px solid var(--color-border)',
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
          {currentTab === 'seasons' && <SeasonForm seasons={seasons} canEdit={canEdit('seasons')} user={user} />}
          {currentTab === 'teams' && <TeamForm teams={teams} canEdit={canEdit('teams')} user={user} />}
          {currentTab === 'players' && <PlayersTab teams={teams} canEdit={canEdit('players')} user={user} />}
          {currentTab === 'courts' && <CourtForm courts={courts} canEdit={canEdit('courts')} user={user} />}
          {currentTab === 'fixture' && <FixtureTab teams={teams} activeSeason={activeSeason} canEdit={canEdit('fixture')} user={user} />}
          {currentTab === 'matches' && <MatchesTab teams={teams} courts={courts} activeSeason={activeSeason} canEdit={canEdit('matches')} canScoring={canView('scoring')} user={user} />}
          {currentTab === 'scoring' && <ScoringTab teams={teams} courts={courts} activeSeason={activeSeason} canEdit={canEdit('scoring')} user={user} />}
          {currentTab === 'posts' && <PostsTab canEdit={canEdit('posts')} user={user} />}
          {currentTab === 'updates' && <UpdatesManager isOwner={isOwner} user={user} userDoc={userDoc} />}
          {currentTab === 'settings' && isOwner && <SettingsManager user={user} />}
          {currentTab === 'users' && isOwner && <UserManager currentUser={user} />}
          {currentTab === 'audit' && isOwner && <AuditLog />}
        </>
      )}
    </PageShell>
  );
}
