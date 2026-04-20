import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useDocument } from '../hooks/useDocument';
import { useMatchEvents } from '../hooks/useMatchEvents';
import { useTeams } from '../hooks/useTeams';
import { usePlayers } from '../hooks/usePlayers';
import { useCourts } from '../hooks/useCourts';
import { useMatchClock } from '../hooks/useMatchClock';
import { useMatchStints } from '../hooks/useMatchStints';
import { aggregateStintsByPlayer, formatMinutes } from '../lib/stints';
import PageShell from '../components/layout/PageShell';
import TeamLogo from '../components/common/TeamLogo';
import LiveBadge from '../components/common/LiveBadge';
import LoadingSpinner from '../components/common/LoadingSpinner';

const EVENT_LABELS = {
  '2pt': { true: '+2', false: '2pts err' },
  '3pt': { true: '+3', false: '3pts err' },
  'ft': { true: 'TL', false: 'TL err' },
  'foul': 'Falta',
  'foulTech': 'Falta tecnica',
  'foulUnsport': 'Falta antideportiva',
  'ejection': 'Expulsion',
  'assist': 'Asistencia',
  'offRebound': 'Reb. ofensivo',
  'defRebound': 'Reb. defensivo',
  'steal': 'Robo',
  'block': 'Tapon',
  'turnover': 'Perdida',
};

const PERSONAL_FOUL_TYPES = ['foul', 'foulTech', 'foulUnsport'];

function getEventLabel(event) {
  const label = EVENT_LABELS[event.type];
  if (typeof label === 'string') return label;
  return label?.[event.made] || event.type;
}

function computeBoxScore(events, players, minutesByPlayer = {}) {
  const stats = {};
  players.forEach(p => {
    stats[p.id] = {
      playerId: p.id,
      name: `${p.firstName} ${p.lastName}`,
      number: p.number,
      teamId: p.teamId,
      points: 0,
      twoMade: 0, twoAtt: 0,
      threeMade: 0, threeAtt: 0,
      ftMade: 0, ftAtt: 0,
      fouls: 0, assists: 0,
      offReb: 0, defReb: 0, rebounds: 0,
      steals: 0, blocks: 0, turnovers: 0,
      minutesMs: minutesByPlayer[p.id] || 0,
    };
  });

  events.forEach(e => {
    const s = stats[e.playerId];
    if (!s) return;
    switch (e.type) {
      case '2pt': s.twoAtt++; if (e.made) { s.twoMade++; s.points += 2; } break;
      case '3pt': s.threeAtt++; if (e.made) { s.threeMade++; s.points += 3; } break;
      case 'ft': s.ftAtt++; if (e.made) { s.ftMade++; s.points += 1; } break;
      case 'foul':
      case 'foulTech':
      case 'foulUnsport':
        s.fouls++;
        break;
      case 'assist': s.assists++; break;
      case 'offRebound': s.offReb++; s.rebounds++; break;
      case 'defRebound': s.defReb++; s.rebounds++; break;
      case 'steal': s.steals++; break;
      case 'block': s.blocks++; break;
      case 'turnover': s.turnovers++; break;
    }
  });

  return Object.values(stats).filter(s =>
    s.points || s.twoAtt || s.threeAtt || s.ftAtt || s.fouls ||
    s.assists || s.rebounds || s.steals || s.blocks || s.turnovers || s.minutesMs
  ).sort((a, b) => b.points - a.points);
}

function BoxScoreTable({ title, team, playerStats }) {
  if (playerStats.length === 0) return null;

  const cols = [
    { key: 'number', label: '#', align: 'center' },
    { key: 'name', label: 'Jugador', align: 'left' },
    { key: 'min', label: 'MIN', align: 'center', format: s => s.minutesMs ? formatMinutes(s.minutesMs) : '—' },
    { key: 'points', label: 'Pts', align: 'center', bold: true },
    { key: 'two', label: '2P', align: 'center', format: s => `${s.twoMade}/${s.twoAtt}` },
    { key: 'three', label: '3P', align: 'center', format: s => `${s.threeMade}/${s.threeAtt}` },
    { key: 'ft', label: 'TL', align: 'center', format: s => `${s.ftMade}/${s.ftAtt}` },
    { key: 'rebounds', label: 'Reb', align: 'center' },
    { key: 'assists', label: 'Ast', align: 'center' },
    { key: 'steals', label: 'Rob', align: 'center', hide: true },
    { key: 'blocks', label: 'Tap', align: 'center', hide: true },
    { key: 'turnovers', label: 'Per', align: 'center', hide: true },
    { key: 'fouls', label: 'Fal', align: 'center' },
  ];

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        <TeamLogo url={team?.logoUrl} name={team?.name} size={24} />
        <h3 className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>{title}</h3>
      </div>
      <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--color-border)' }}>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ backgroundColor: 'var(--color-table-header)', color: '#ffffff' }}>
              {cols.map(c => (
                <th key={c.key} className={`px-2 py-2 font-semibold whitespace-nowrap ${c.align === 'left' ? 'text-left' : 'text-center'} ${c.hide ? 'hidden md:table-cell' : ''}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {playerStats.map((s, idx) => (
              <tr key={s.playerId} style={{
                backgroundColor: idx % 2 === 1 ? 'var(--color-table-row-alt)' : 'var(--color-bg-card)',
                borderBottom: '1px solid var(--color-border)',
              }}>
                {cols.map(c => (
                  <td key={c.key} className={`px-2 py-2 whitespace-nowrap ${c.align === 'left' ? 'text-left' : 'text-center'} ${c.bold ? 'font-bold' : ''} ${c.hide ? 'hidden md:table-cell' : ''}`}
                    style={{ color: c.bold ? 'var(--color-primary)' : 'var(--color-text)' }}>
                    {c.format ? c.format(s) : s[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EventLog({ events, players, homeTeamId }) {
  const playerMap = {};
  players.forEach(p => { playerMap[p.id] = p; });

  const byQuarter = {};
  events.forEach(e => {
    const q = e.quarter || 1;
    if (!byQuarter[q]) byQuarter[q] = [];
    byQuarter[q].push(e);
  });

  const quarters = Object.keys(byQuarter).map(Number).sort((a, b) => a - b);

  if (quarters.length === 0) return null;

  return (
    <div>
      <h3 className="font-bold text-sm mb-3" style={{ color: 'var(--color-text)' }}>Jugada por jugada</h3>
      {quarters.map(q => (
        <div key={q} className="mb-4">
          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--color-primary)' }}>
            {q <= 4 ? `Cuarto ${q}` : `Overtime ${q - 4}`}
          </p>
          <div className="space-y-1">
            {byQuarter[q].map(event => {
              const player = playerMap[event.playerId];
              const isHome = event.teamId === homeTeamId;
              return (
                <div
                  key={event.id}
                  className="flex items-center text-xs px-3 py-1.5 rounded"
                  style={{
                    backgroundColor: 'var(--color-bg-hover)',
                    justifyContent: isHome ? 'flex-start' : 'flex-end',
                  }}
                >
                  <span style={{ color: 'var(--color-text-secondary)' }}>
                    <strong>#{player?.number}</strong> {player?.lastName} — {getEventLabel(event)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function MatchDetailPage() {
  const { matchId } = useParams();
  const { data: match, loading: matchLoading } = useDocument(`matches/${matchId}`);
  const { data: events, loading: eventsLoading } = useMatchEvents(matchId);
  const { data: teams, loading: teamsLoading } = useTeams();
  const { data: allPlayers, loading: playersLoading } = usePlayers();
  const { data: courts, loading: courtsLoading } = useCourts();
  const { data: stints } = useMatchStints(matchId);

  const { homeTeam, awayTeam, homePlayers, awayPlayers, court } = useMemo(() => {
    if (!match) return { homeTeam: null, awayTeam: null, homePlayers: [], awayPlayers: [], court: null };
    const overrides = match.playerNumbers || {};
    const hasRoster = Object.keys(overrides).length > 0;
    const inRoster = (p) => !hasRoster || p.id in overrides;
    const withMatchNumber = (p) => ({ ...p, number: overrides[p.id] ?? p.number });
    return {
      homeTeam: teams.find(t => t.id === match.homeTeamId),
      awayTeam: teams.find(t => t.id === match.awayTeamId),
      homePlayers: allPlayers.filter(p => p.teamId === match.homeTeamId).filter(inRoster).map(withMatchNumber),
      awayPlayers: allPlayers.filter(p => p.teamId === match.awayTeamId).filter(inRoster).map(withMatchNumber),
      court: match.courtId ? courts.find(c => c.id === match.courtId) : null,
    };
  }, [match, teams, allPlayers, courts]);

  const minutesByPlayer = useMemo(() => aggregateStintsByPlayer(stints), [stints]);

  const { homeStats, awayStats } = useMemo(() => {
    if (!match) return { homeStats: [], awayStats: [] };
    if (events.length === 0 && Object.keys(minutesByPlayer).length === 0) {
      return { homeStats: [], awayStats: [] };
    }
    const homeEvents = events.filter(e => e.teamId === match.homeTeamId);
    const awayEvents = events.filter(e => e.teamId === match.awayTeamId);
    return {
      homeStats: computeBoxScore(homeEvents, homePlayers, minutesByPlayer),
      awayStats: computeBoxScore(awayEvents, awayPlayers, minutesByPlayer),
    };
  }, [match, events, homePlayers, awayPlayers, minutesByPlayer]);

  const { mmss: clockMmss, running: clockRunning } = useMatchClock(match);

  const loading = matchLoading || eventsLoading || teamsLoading || playersLoading || courtsLoading;

  if (loading) return <PageShell><LoadingSpinner /></PageShell>;

  if (!match) {
    return (
      <PageShell>
        <p style={{ color: 'var(--color-text-secondary)' }}>Partido no encontrado</p>
        <Link to="/" className="text-sm underline" style={{ color: 'var(--color-primary)' }}>Volver al fixture</Link>
      </PageShell>
    );
  }

  const isLive = match.status === 'live';
  const isFinished = match.status === 'finished';
  const homeWon = isFinished && (match.homeScore || 0) > (match.awayScore || 0);
  const awayWon = isFinished && (match.awayScore || 0) > (match.homeScore || 0);

  const currentQuarter = match.quarter || 1;
  const teamFoulsQ = (teamId) =>
    events.filter(e => PERSONAL_FOUL_TYPES.includes(e.type) && e.teamId === teamId && (e.quarter || 1) === currentQuarter).length;
  const homeTeamFouls = isLive ? teamFoulsQ(match.homeTeamId) : 0;
  const awayTeamFouls = isLive ? teamFoulsQ(match.awayTeamId) : 0;
  const homeTO = !!(match.timeouts?.home?.[currentQuarter]);
  const awayTO = !!(match.timeouts?.away?.[currentQuarter]);

  const formatDate = (d) => {
    if (!d) return '';
    const date = d.toDate ? d.toDate() : new Date(d);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <PageShell>
      <div className="mb-4">
        <Link to="/" className="text-sm" style={{ color: 'var(--color-primary)' }}>
          &larr; Volver al fixture
        </Link>
      </div>

      {/* Scoreboard */}
      <div
        className="rounded-lg p-6 mb-6 text-center"
        style={{ backgroundColor: 'var(--color-table-header)', color: '#ffffff' }}
      >
        {/* 1. EN VIVO */}
        {isLive && (
          <div className="flex items-center justify-center mb-2">
            <LiveBadge />
          </div>
        )}
        {isFinished && (
          <p className="text-xs font-bold tracking-widest mb-2 opacity-70">FINAL</p>
        )}

        {/* 2. Cuarto + Reloj */}
        {isLive && (
          <div
            className="inline-flex items-stretch rounded-md overflow-hidden mb-3 font-bold tabular-nums"
            style={{ border: '1px solid rgba(255,255,255,0.3)' }}
            title={clockRunning ? 'Reloj en marcha' : 'Reloj pausado'}
          >
            <span
              className="px-3 flex items-center text-4xl md:text-5xl leading-none"
              style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}
            >
              {(match.quarter || 1) >= 5 ? `OT${match.quarter > 5 ? match.quarter - 4 : ''}` : `Q${match.quarter || 1}`}
            </span>
            <span
              className="px-3 flex items-center gap-2 text-4xl md:text-5xl font-mono leading-none"
              style={{ borderLeft: '1px solid rgba(255,255,255,0.3)' }}
            >
              <span className="text-xl md:text-2xl opacity-80">{clockRunning ? '▶' : '❚❚'}</span>
              {clockMmss}
            </span>
          </div>
        )}

        {/* 3. Faltas de equipo y tiempos muertos */}
        {isLive && (
          <div className="mb-3 flex items-center justify-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span
                className="px-1.5 py-0.5 rounded font-medium"
                style={{
                  backgroundColor: homeTeamFouls >= 4 ? 'rgba(239,68,68,0.85)' : 'rgba(255,255,255,0.15)',
                }}
                title="Faltas de equipo en el cuarto actual"
              >
                F {Math.min(homeTeamFouls, 5)}/5
              </span>
              <span
                className="px-1.5 py-0.5 rounded font-medium"
                style={{
                  backgroundColor: homeTO ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.15)',
                  color: homeTO ? '#111827' : '#ffffff',
                }}
                title={`Tiempo muerto Q${currentQuarter} ${homeTO ? '(usado)' : '(disponible)'}`}
              >
                {homeTO ? '● TO' : '○ TO'}
              </span>
            </div>
            <span className="opacity-60">·</span>
            <div className="flex items-center gap-1.5">
              <span
                className="px-1.5 py-0.5 rounded font-medium"
                style={{
                  backgroundColor: awayTO ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.15)',
                  color: awayTO ? '#111827' : '#ffffff',
                }}
                title={`Tiempo muerto Q${currentQuarter} ${awayTO ? '(usado)' : '(disponible)'}`}
              >
                {awayTO ? '● TO' : '○ TO'}
              </span>
              <span
                className="px-1.5 py-0.5 rounded font-medium"
                style={{
                  backgroundColor: awayTeamFouls >= 4 ? 'rgba(239,68,68,0.85)' : 'rgba(255,255,255,0.15)',
                }}
                title="Faltas de equipo en el cuarto actual"
              >
                F {Math.min(awayTeamFouls, 5)}/5
              </span>
            </div>
          </div>
        )}

        {/* 4. Puntaje centrado */}
        <div className="flex items-center justify-center gap-6 md:gap-10">
          <div className="flex flex-col items-center gap-2">
            <TeamLogo url={homeTeam?.logoUrl} name={homeTeam?.name} size={56} />
            <p className="text-sm font-medium opacity-90">{homeTeam?.name}</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-4xl md:text-5xl font-bold" style={{ opacity: awayWon ? 0.4 : 1 }}>
              {match.homeScore || 0}
            </span>
            <span className="text-xl opacity-40">-</span>
            <span className="text-4xl md:text-5xl font-bold" style={{ opacity: homeWon ? 0.4 : 1 }}>
              {match.awayScore || 0}
            </span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <TeamLogo url={awayTeam?.logoUrl} name={awayTeam?.name} size={56} />
            <p className="text-sm font-medium opacity-90">{awayTeam?.name}</p>
          </div>
        </div>

        {/* 5 y 6. Fecha programada y cancha/fecha */}
        <div className="mt-3 text-xs opacity-60 space-y-0.5">
          {match.scheduledDate && <p>{formatDate(match.scheduledDate)} {match.scheduledTime && `- ${match.scheduledTime}`}</p>}
          <p>
            {court ? `${court.name} - ` : ''}Fecha {match.round}
          </p>
        </div>
      </div>

      {/* Box Score */}
      {(homeStats.length > 0 || awayStats.length > 0) ? (
        <>
          <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--color-text)' }}>Estadisticas del partido</h2>
          <BoxScoreTable title={homeTeam?.name || 'Local'} team={homeTeam} playerStats={homeStats} />
          <BoxScoreTable title={awayTeam?.name || 'Visitante'} team={awayTeam} playerStats={awayStats} />
        </>
      ) : (
        <p className="text-sm text-center py-6" style={{ color: 'var(--color-text-muted)' }}>
          No hay estadisticas detalladas para este partido
        </p>
      )}

      {/* Play-by-play */}
      {events.length > 0 && (
        <div className="mt-6">
          <EventLog events={events} players={[...homePlayers, ...awayPlayers]} homeTeamId={match.homeTeamId} />
        </div>
      )}
    </PageShell>
  );
}
