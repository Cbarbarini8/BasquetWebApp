import { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { collection, doc, updateDoc, writeBatch, increment, serverTimestamp, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { logStatsParticipation } from '../../lib/audit';
import { useToast } from '../../context/ToastContext';
import { useMatchClock, defaultQuarterMs, pausedRemainingFromMatch, formatClock } from '../../hooks/useMatchClock';

const EVENT_BUTTONS = [
  { type: '2pt', label: '+2', made: true, points: 2, color: 'var(--color-success)' },
  { type: '2pt', label: '2 Err', made: false, points: 0, color: '#6b7280' },
  { type: '3pt', label: '+3', made: true, points: 3, color: 'var(--color-primary)' },
  { type: '3pt', label: '3 Err', made: false, points: 0, color: '#6b7280' },
  { type: 'ft', label: 'TL', made: true, points: 1, color: 'var(--color-accent)' },
  { type: 'ft', label: 'TL Err', made: false, points: 0, color: '#6b7280' },
  { type: 'foul', label: 'Falta', color: 'var(--color-danger)' },
  { type: 'foulTech', label: 'F. Tec', color: '#ea580c' },
  { type: 'foulUnsport', label: 'F. Anti', color: '#b91c1c' },
  { type: 'ejection', label: 'Expul', color: '#18181b' },
  { type: 'assist', label: 'Asist', color: '#8b5cf6' },
  { type: 'offRebound', label: 'Reb Of', color: '#0891b2' },
  { type: 'defRebound', label: 'Reb Def', color: '#0d9488' },
  { type: 'steal', label: 'Robo', color: '#059669' },
  { type: 'block', label: 'Tapon', color: '#7c3aed' },
  { type: 'turnover', label: 'Perdida', color: '#dc2626' },
];

const EVENT_LABELS = {
  '2pt': { true: '+2 pts', false: '2pts err' },
  '3pt': { true: '+3 pts', false: '3pts err' },
  'ft': { true: 'TL conv', false: 'TL err' },
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
const FLAGRANT_FOUL_TYPES = ['foulTech', 'foulUnsport'];
const PERSONAL_FOUL_LIMIT = 5;
const FLAGRANT_FOUL_LIMIT = 2;

const MAX_ON_COURT = 5;

function PlayerJersey({ player, selected, onClick, compact = false, fouls = 0 }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center rounded-lg transition-all active:scale-95 ${
        compact ? 'py-0.5 px-1' : 'py-3 px-2'
      }`}
      style={{
        backgroundColor: selected ? 'var(--color-primary)' : 'var(--color-bg-card)',
        border: selected ? '2px solid var(--color-primary)' : '2px solid var(--color-border)',
        color: selected ? '#ffffff' : 'var(--color-text)',
        minHeight: compact ? '38px' : '64px',
      }}
    >
      {fouls > 0 && (
        <span
          className={`absolute font-bold rounded-full flex items-center justify-center ${
            compact ? 'top-0 right-0 text-[9px] w-3.5 h-3.5' : 'top-0.5 right-0.5 text-[10px] w-4 h-4'
          }`}
          style={{
            backgroundColor: fouls >= 5 ? 'var(--color-danger)' : fouls >= 4 ? '#f59e0b' : 'var(--color-danger)',
            color: '#ffffff',
            opacity: fouls >= 4 ? 1 : 0.85,
          }}
          title={`${fouls} falta${fouls !== 1 ? 's' : ''}`}
        >
          {fouls}
        </span>
      )}
      <span className={`font-bold leading-none ${compact ? 'text-base' : 'text-2xl'}`}>
        #{player.number}
      </span>
      <span className={`truncate max-w-full ${compact ? 'text-[9px] leading-tight' : 'text-xs mt-0.5'}`}
        style={{ opacity: 0.9 }}
      >
        {player.lastName}
      </span>
    </button>
  );
}

export default function LiveScoring({ match, events, homePlayers, awayPlayers, homeTeam, awayTeam, canEdit = true, user, compact = false }) {
  const { toast } = useToast();
  const [selectedPlayer, setSelectedPlayer] = useState({ home: '', away: '' });
  const [editingCourt, setEditingCourt] = useState({ home: false, away: false });
  const [editingClock, setEditingClock] = useState(false);
  const [clockInput, setClockInput] = useState('');
  const { mmss, remainingMs, running } = useMatchClock(match);
  const autoStoppedRef = useRef(false);

  useEffect(() => {
    if (!canEdit) return;
    if (running && remainingMs <= 0 && !autoStoppedRef.current) {
      autoStoppedRef.current = true;
      updateDoc(doc(db, 'matches', match.id), {
        clockRunning: false,
        clockRemainingMs: 0,
        clockStartedAt: null,
      }).then(() => {
        toast.warning(`Fin del cuarto Q${match.quarter || 1}`);
      });
    }
    if (!running || remainingMs > 0) autoStoppedRef.current = false;
  }, [running, remainingMs, canEdit, match.id, match.quarter, toast]);

  const allPlayers = [...homePlayers, ...awayPlayers];
  const getPlayerLabel = (id) => {
    const p = allPlayers.find(x => x.id === id);
    return p ? `#${p.number} ${p.lastName}` : id;
  };

  const onCourtHomeIds = match.onCourtHome || [];
  const onCourtAwayIds = match.onCourtAway || [];
  const currentQuarter = match.quarter || 1;

  const { playerPersonalFouls, playerFlagrantFouls, ejectedPlayers } = useMemo(() => {
    const personal = {};
    const flagrant = {};
    const ejected = new Set();
    events.forEach(e => {
      if (PERSONAL_FOUL_TYPES.includes(e.type)) {
        personal[e.playerId] = (personal[e.playerId] || 0) + 1;
      }
      if (FLAGRANT_FOUL_TYPES.includes(e.type)) {
        flagrant[e.playerId] = (flagrant[e.playerId] || 0) + 1;
      }
      if (e.type === 'ejection') {
        ejected.add(e.playerId);
      }
    });
    return { playerPersonalFouls: personal, playerFlagrantFouls: flagrant, ejectedPlayers: ejected };
  }, [events]);

  const ejectionReason = (playerId) => {
    if (ejectedPlayers.has(playerId)) return 'expulsion directa';
    if ((playerFlagrantFouls[playerId] || 0) >= FLAGRANT_FOUL_LIMIT) return '2 faltas tecnicas/antideportivas';
    if ((playerPersonalFouls[playerId] || 0) >= PERSONAL_FOUL_LIMIT) return '5 faltas';
    return null;
  };

  const teamFoulsQ = (teamId) =>
    events.filter(e => PERSONAL_FOUL_TYPES.includes(e.type) && e.teamId === teamId && (e.quarter || 1) === currentQuarter).length;

  const homeTeamFouls = teamFoulsQ(match.homeTeamId);
  const awayTeamFouls = teamFoulsQ(match.awayTeamId);

  const toggleTimeout = async (side) => {
    if (!canEdit) return;
    const current = !!(match.timeouts?.[side]?.[currentQuarter]);
    await updateDoc(doc(db, 'matches', match.id), {
      [`timeouts.${side}.${currentQuarter}`]: !current,
    });
    if (user) await logStatsParticipation(user, match.id, `${homeTeam?.name || 'Local'} vs ${awayTeam?.name || 'Visitante'}`);
  };

  const onCourtHomePlayers = homePlayers.filter(p => onCourtHomeIds.includes(p.id));
  const onCourtAwayPlayers = awayPlayers.filter(p => onCourtAwayIds.includes(p.id));

  const togglePlayerOnCourt = async (side, playerId) => {
    const field = side === 'home' ? 'onCourtHome' : 'onCourtAway';
    const currentIds = side === 'home' ? onCourtHomeIds : onCourtAwayIds;
    const isOn = currentIds.includes(playerId);
    if (!isOn) {
      const reason = ejectionReason(playerId);
      if (reason) {
        toast.error(`Este jugador esta expulsado (${reason}) y no puede volver a la cancha.`);
        return;
      }
    }
    if (!isOn && currentIds.length >= MAX_ON_COURT) {
      toast.warning(`Maximo ${MAX_ON_COURT} jugadores en cancha. Sacar uno primero.`);
      return;
    }
    await updateDoc(doc(db, 'matches', match.id), {
      [field]: isOn ? arrayRemove(playerId) : arrayUnion(playerId),
    });
  };

  const addEvent = async (side, eventDef) => {
    const playerId = selectedPlayer[side];
    if (!playerId) {
      toast.info('Selecciona un jugador primero');
      return;
    }

    const teamId = side === 'home' ? match.homeTeamId : match.awayTeamId;
    const scoreField = side === 'home' ? 'homeScore' : 'awayScore';

    const eventData = {
      type: eventDef.type,
      playerId,
      teamId,
      quarter: match.quarter || 1,
      timestamp: serverTimestamp(),
    };

    if (eventDef.made !== undefined) {
      eventData.made = eventDef.made;
    }

    const batch = writeBatch(db);

    const eventRef = doc(collection(db, `matches/${match.id}/events`));
    batch.set(eventRef, eventData);

    if (eventDef.points && eventDef.points > 0) {
      const matchRef = doc(db, 'matches', match.id);
      batch.update(matchRef, { [scoreField]: increment(eventDef.points) });
    }

    // Si este evento deja al jugador expulsado, sacarlo de cancha y abrir seleccion de reemplazo
    const isFoulType = PERSONAL_FOUL_TYPES.includes(eventDef.type);
    const isFlagrantType = FLAGRANT_FOUL_TYPES.includes(eventDef.type);
    const nextPersonal = isFoulType ? (playerPersonalFouls[playerId] || 0) + 1 : (playerPersonalFouls[playerId] || 0);
    const nextFlagrant = isFlagrantType ? (playerFlagrantFouls[playerId] || 0) + 1 : (playerFlagrantFouls[playerId] || 0);
    const willReachFive = isFoulType && nextPersonal >= PERSONAL_FOUL_LIMIT;
    const willReachTwoFlagrant = isFlagrantType && nextFlagrant >= FLAGRANT_FOUL_LIMIT;
    const isDirectEjection = eventDef.type === 'ejection';
    const willBeEjected = willReachFive || willReachTwoFlagrant || isDirectEjection;

    if (willBeEjected) {
      const courtField = side === 'home' ? 'onCourtHome' : 'onCourtAway';
      batch.update(doc(db, 'matches', match.id), { [courtField]: arrayRemove(playerId) });
    }

    await batch.commit();

    if (willBeEjected) {
      const label = getPlayerLabel(playerId);
      setSelectedPlayer(prev => ({ ...prev, [side]: '' }));
      setEditingCourt(prev => ({ ...prev, [side]: true }));
      const reason = isDirectEjection ? 'expulsion directa'
        : willReachTwoFlagrant ? '2 faltas tecnicas/antideportivas'
        : '5 faltas';
      toast.error(`${label} queda expulsado (${reason}). Debe ser reemplazado.`, 6000);
    }

    if (user) await logStatsParticipation(user, match.id, `${homeTeam?.name || 'Local'} vs ${awayTeam?.name || 'Visitante'}`);
  };

  const undoEvent = async (event) => {
    if (!window.confirm('Deshacer este evento?')) return;

    const batch = writeBatch(db);

    batch.delete(doc(db, `matches/${match.id}/events`, event.id));

    const isScoring = ['2pt', '3pt', 'ft'].includes(event.type) && event.made;
    if (isScoring) {
      const points = event.type === '2pt' ? 2 : event.type === '3pt' ? 3 : 1;
      const scoreField = event.teamId === match.homeTeamId ? 'homeScore' : 'awayScore';
      batch.update(doc(db, 'matches', match.id), { [scoreField]: increment(-points) });
    }

    await batch.commit();
    if (user) await logStatsParticipation(user, match.id, `${homeTeam?.name || 'Local'} vs ${awayTeam?.name || 'Visitante'}`);
  };

  const updateQuarter = async (q) => {
    await updateDoc(doc(db, 'matches', match.id), {
      quarter: q,
      clockRunning: false,
      clockRemainingMs: defaultQuarterMs(q),
      clockStartedAt: null,
    });
    if (user) await logStatsParticipation(user, match.id, `${homeTeam?.name || 'Local'} vs ${awayTeam?.name || 'Visitante'}`);
  };

  const toggleClock = async () => {
    if (!canEdit) return;
    if (running) {
      const remaining = pausedRemainingFromMatch(match);
      await updateDoc(doc(db, 'matches', match.id), {
        clockRunning: false,
        clockRemainingMs: remaining,
        clockStartedAt: null,
      });
    } else {
      const base = typeof match.clockRemainingMs === 'number' ? match.clockRemainingMs : defaultQuarterMs(match.quarter || 1);
      if (base <= 0) {
        toast.info('El reloj esta en 00:00. Modificalo antes de iniciar.');
        return;
      }
      await updateDoc(doc(db, 'matches', match.id), {
        clockRunning: true,
        clockRemainingMs: base,
        clockStartedAt: Date.now(),
      });
    }
  };

  const openClockEdit = () => {
    if (!canEdit) return;
    const base = pausedRemainingFromMatch(match);
    setClockInput(formatClock(base));
    setEditingClock(true);
  };

  const saveClockEdit = async () => {
    const match1 = clockInput.match(/^(\d{1,2}):(\d{2})$/);
    const match2 = clockInput.match(/^(\d{1,3})$/);
    let ms;
    if (match1) {
      const mm = parseInt(match1[1]);
      const ss = parseInt(match1[2]);
      if (ss >= 60) { toast.error('Segundos invalidos'); return; }
      ms = (mm * 60 + ss) * 1000;
    } else if (match2) {
      ms = parseInt(match2[1]) * 60 * 1000;
    } else {
      toast.error('Formato invalido. Usa MM:SS o solo minutos.');
      return;
    }
    await updateDoc(doc(db, 'matches', match.id), {
      clockRunning: false,
      clockRemainingMs: ms,
      clockStartedAt: null,
    });
    setEditingClock(false);
  };

  const getEventLabel = (event) => {
    const label = EVENT_LABELS[event.type];
    if (typeof label === 'string') return label;
    return label?.[event.made] || event.type;
  };

  const renderSide = (side, team, onCourtPlayers) => {
    const selected = selectedPlayer[side];
    const isEditing = editingCourt[side];
    const teamPlayers = side === 'home' ? homePlayers : awayPlayers;
    const teamEvents = events.filter(e => e.teamId === (side === 'home' ? match.homeTeamId : match.awayTeamId));
    const lastEvent = teamEvents[0];
    const teamFouls = side === 'home' ? homeTeamFouls : awayTeamFouls;
    const timeoutUsed = !!(match.timeouts?.[side]?.[currentQuarter]);
    const inBonus = teamFouls >= 4;

    return (
      <div className={`flex-1 ${compact ? 'min-w-0' : 'min-w-[280px]'}`}>
        <div className={`flex items-center justify-between ${compact ? 'mb-1' : 'mb-2'}`}>
          <h3 className={`font-bold truncate ${compact ? 'text-xs' : 'text-lg'}`} style={{ color: 'var(--color-text)' }}>
            {team?.name || 'Equipo'}
          </h3>
          {canEdit && (
            <button
              onClick={() => setEditingCourt(prev => ({ ...prev, [side]: !prev[side] }))}
              className={`rounded shrink-0 ${compact ? 'text-[10px] px-1.5 py-0.5 ml-1' : 'text-xs px-2 py-1'}`}
              style={{
                backgroundColor: isEditing ? 'var(--color-primary)' : 'transparent',
                color: isEditing ? '#ffffff' : 'var(--color-primary)',
                border: '1px solid var(--color-primary)',
              }}
            >
              {isEditing ? 'Listo' : (compact ? 'Edit' : 'Editar cancha')}
            </button>
          )}
        </div>
        <div className={`flex items-center gap-2 ${compact ? 'mb-1 text-[10px]' : 'mb-2 text-xs'}`}>
          <span
            className="px-1.5 py-0.5 rounded font-medium"
            style={{
              backgroundColor: inBonus ? 'var(--color-danger)' : 'var(--color-bg-hover)',
              color: inBonus ? '#ffffff' : 'var(--color-text-secondary)',
              border: inBonus ? 'none' : '1px solid var(--color-border)',
            }}
            title={inBonus ? 'En bonus: proxima falta son tiros libres' : `Faltas del equipo en Q${currentQuarter}`}
          >
            Faltas {Math.min(teamFouls, 5)}/5
          </span>
          <button
            type="button"
            onClick={() => toggleTimeout(side)}
            disabled={!canEdit}
            className="px-1.5 py-0.5 rounded font-medium disabled:cursor-default"
            style={{
              backgroundColor: timeoutUsed ? 'var(--color-primary)' : 'transparent',
              color: timeoutUsed ? '#ffffff' : 'var(--color-text-secondary)',
              border: '1px solid var(--color-border)',
            }}
            title={`Tiempo muerto Q${currentQuarter} ${timeoutUsed ? '(usado)' : '(disponible)'}`}
          >
            {timeoutUsed ? '● TO' : '○ TO'}
          </button>
        </div>

        {/* Modo edicion de cancha */}
        {isEditing && canEdit && (
          <div
            className={`rounded-md ${compact ? 'p-1 mb-1' : 'p-3 mb-3'}`}
            style={{ backgroundColor: 'var(--color-bg-hover)', border: '1px solid var(--color-border)' }}
          >
            {!compact && (
              <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
                Selecciona hasta {MAX_ON_COURT} jugadores en cancha ({onCourtPlayers.length}/{MAX_ON_COURT})
              </p>
            )}
            <div className={`grid gap-1 ${compact ? 'grid-cols-5' : 'grid-cols-4 sm:grid-cols-5 gap-1.5'}`}>
              {teamPlayers.map(p => {
                const isOn = (side === 'home' ? onCourtHomeIds : onCourtAwayIds).includes(p.id);
                return (
                  <PlayerJersey
                    key={p.id}
                    player={p}
                    selected={isOn}
                    onClick={() => togglePlayerOnCourt(side, p.id)}
                    compact
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Jugadores en cancha + botones de eventos */}
        {!isEditing && (
          <>
            {onCourtPlayers.length === 0 ? (
              <div
                className={`rounded-md text-center ${compact ? 'p-1 mb-1 text-[10px]' : 'p-3 mb-3 text-xs'}`}
                style={{
                  backgroundColor: 'var(--color-bg-hover)',
                  border: '1px dashed var(--color-border)',
                  color: 'var(--color-text-muted)',
                }}
              >
                {compact ? 'Presiona "Edit" para cargar los 5 iniciales' : 'Sin jugadores en cancha. Presiona "Editar cancha" para marcar los 5 iniciales.'}
              </div>
            ) : compact ? (
              /* Layout compacto: jerseys en el borde exterior, eventos al centro */
              <div className={`flex gap-1 mb-1 ${side === 'away' ? 'flex-row-reverse' : ''}`}>
                <div className="grid grid-cols-1 gap-1 w-12 shrink-0" style={{ gridTemplateRows: 'repeat(5, minmax(38px, 1fr))' }}>
                  {Array.from({ length: 5 }).map((_, i) => {
                    const p = onCourtPlayers[i];
                    if (!p) {
                      return (
                        <div
                          key={`empty-${side}-${i}`}
                          className="rounded-lg"
                          style={{
                            border: '2px dashed var(--color-border)',
                            backgroundColor: 'var(--color-bg-card)',
                          }}
                        />
                      );
                    }
                    return (
                      <PlayerJersey
                        key={p.id}
                        player={p}
                        selected={selected === p.id}
                        onClick={() => setSelectedPlayer(prev => ({ ...prev, [side]: p.id }))}
                        compact
                        fouls={playerPersonalFouls[p.id] || 0}
                      />
                    );
                  })}
                </div>
                {canEdit && (
                  <div
                    className="grid grid-cols-3 gap-1 flex-1"
                    style={{ gridTemplateRows: 'repeat(5, minmax(38px, 1fr))' }}
                  >
                    {EVENT_BUTTONS.map((btn, idx) => (
                      <button
                        key={idx}
                        onClick={() => addEvent(side, btn)}
                        disabled={!selected}
                        className="rounded-md text-white font-bold disabled:opacity-30 transition-opacity active:scale-95 px-0.5 text-[10px] leading-none"
                        style={{ backgroundColor: btn.color }}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-5 gap-1.5 mb-3">
                {onCourtPlayers.map(p => (
                  <PlayerJersey
                    key={p.id}
                    player={p}
                    selected={selected === p.id}
                    onClick={() => setSelectedPlayer(prev => ({ ...prev, [side]: p.id }))}
                    compact={compact}
                    fouls={playerPersonalFouls[p.id] || 0}
                  />
                ))}
              </div>
            )}

          </>
        )}

        {/* Botones de eventos (solo modo no compacto; en compacto estan al lado de los jerseys) */}
        {canEdit && !isEditing && !compact && (
          <div className="grid grid-cols-3 gap-1.5 mb-4">
            {EVENT_BUTTONS.map((btn, idx) => (
              <button
                key={idx}
                onClick={() => addEvent(side, btn)}
                disabled={!selected}
                className="rounded-md text-white font-bold disabled:opacity-30 transition-opacity active:scale-95 py-2.5 px-1 text-xs"
                style={{ backgroundColor: btn.color }}
              >
                {btn.label}
              </button>
            ))}
          </div>
        )}

        {compact ? (
          lastEvent && (() => {
            const p = teamPlayers.find(pl => pl.id === lastEvent.playerId);
            return (
              <div
                className="flex items-center justify-between px-1 py-0.5 rounded text-[10px]"
                style={{ backgroundColor: 'var(--color-bg-hover)' }}
              >
                <span className="truncate" style={{ color: 'var(--color-text-secondary)' }}>
                  #{p?.number} {p?.lastName} · {getEventLabel(lastEvent)}
                </span>
                {canEdit && (
                  <button
                    onClick={() => undoEvent(lastEvent)}
                    className="shrink-0 px-1 text-base leading-none"
                    style={{ color: 'var(--color-danger)' }}
                    title="Deshacer"
                  >
                    ↶
                  </button>
                )}
              </div>
            );
          })()
        ) : (
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {teamEvents.map(event => {
              const player = teamPlayers.find(p => p.id === event.playerId);
              return (
                <div
                  key={event.id}
                  className="flex items-center justify-between px-2 py-1.5 rounded text-xs"
                  style={{ backgroundColor: 'var(--color-bg-hover)' }}
                >
                  <span style={{ color: 'var(--color-text-secondary)' }}>
                    <strong>#{player?.number}</strong> {player?.lastName} - {getEventLabel(event)}
                    <span className="ml-1" style={{ color: 'var(--color-text-muted)' }}>Q{event.quarter}</span>
                  </span>
                  {canEdit && (
                    <button
                      onClick={() => undoEvent(event)}
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{ color: 'var(--color-danger)' }}
                    >
                      Deshacer
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      {/* Scoreboard */}
      <div
        className={`rounded-lg text-center ${compact ? 'p-2 mb-2' : 'p-4 mb-6'}`}
        style={{ backgroundColor: 'var(--color-table-header)', color: '#ffffff' }}
      >
        {compact ? (
          <div className="flex items-center gap-2">
            <Link
              to="/admin"
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded text-white/85 text-base font-bold"
              style={{ border: '1px solid rgba(255,255,255,0.3)' }}
              title="Volver"
            >
              ←
            </Link>

            {/* Home name + score */}
            <div className="flex-1 min-w-0 flex items-center justify-end gap-2">
              <p className="text-xs opacity-85 truncate leading-tight text-right">
                {homeTeam?.name}
              </p>
              <p className="text-3xl font-bold leading-none tabular-nums">{match.homeScore || 0}</p>
            </div>

            {/* Central: reloj + controles + cuartos */}
            <div className="shrink-0 flex flex-col items-center gap-1">
              {editingClock && canEdit ? (
                <div className="flex items-center gap-1 h-9">
                  <input
                    type="text"
                    value={clockInput}
                    onChange={e => setClockInput(e.target.value)}
                    placeholder="MM:SS"
                    autoFocus
                    className="rounded text-center font-mono font-bold w-20 text-lg h-9 px-1"
                    style={{
                      backgroundColor: '#ffffff',
                      color: '#111827',
                      caretColor: '#111827',
                      colorScheme: 'light',
                      border: '1px solid rgba(255,255,255,0.5)',
                    }}
                  />
                  <button
                    onClick={saveClockEdit}
                    className="h-9 px-2.5 rounded bg-white text-gray-900 font-bold text-xs"
                    title="Guardar"
                  >OK</button>
                  <button
                    onClick={() => setEditingClock(false)}
                    className="h-9 w-8 rounded bg-white/20 text-white font-bold text-sm"
                    title="Cancelar"
                  >✕</button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <span
                    onDoubleClick={canEdit ? openClockEdit : undefined}
                    className="h-9 px-3 flex items-center rounded bg-white/10 font-mono font-bold tabular-nums text-2xl leading-none select-none"
                    style={{
                      color: remainingMs <= 10000 && remainingMs > 0 ? '#fca5a5' : remainingMs === 0 ? '#ef4444' : '#ffffff',
                      cursor: canEdit ? 'pointer' : 'default',
                    }}
                    title={canEdit ? 'Doble click para editar' : undefined}
                  >
                    {mmss}
                  </span>
                  {canEdit && (
                    <>
                      <button
                        onClick={toggleClock}
                        className={`w-9 h-9 rounded font-bold text-sm transition-colors ${
                          running ? 'bg-white text-gray-900' : 'bg-white/25 text-white'
                        }`}
                        title={running ? 'Pausar' : 'Iniciar'}
                      >
                        {running ? '❚❚' : '▶'}
                      </button>
                      <button
                        onClick={openClockEdit}
                        className="w-9 h-9 rounded bg-white/15 text-white font-bold text-sm"
                        title="Editar tiempo"
                      >
                        ✎
                      </button>
                    </>
                  )}
                </div>
              )}
              <div className="flex gap-1">
                {[1, 2, 3, 4].map(q => (
                  <button
                    key={q}
                    onClick={() => updateQuarter(q)}
                    disabled={!canEdit}
                    className={`w-7 h-7 rounded font-bold text-xs transition-colors ${
                      match.quarter === q ? 'bg-white text-gray-900' : 'bg-white/20 text-white'
                    }`}
                  >
                    {q}
                  </button>
                ))}
                <button
                  onClick={() => updateQuarter(5)}
                  disabled={!canEdit}
                  className={`w-9 h-7 rounded font-bold text-xs transition-colors ${
                    match.quarter === 5 ? 'bg-white text-gray-900' : 'bg-white/20 text-white'
                  }`}
                >
                  OT
                </button>
              </div>
            </div>

            {/* Away score + name */}
            <div className="flex-1 min-w-0 flex items-center justify-start gap-2">
              <p className="text-3xl font-bold leading-none tabular-nums">{match.awayScore || 0}</p>
              <p className="text-xs opacity-85 truncate leading-tight text-left">
                {awayTeam?.name}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-6">
            <div className="min-w-0">
              <p className="font-medium opacity-80 truncate text-sm">
                {homeTeam?.name}
              </p>
              <p className="font-bold leading-none text-4xl">{match.homeScore || 0}</p>
            </div>
            <div className="text-center shrink-0">
              {editingClock && canEdit ? (
                <div className="flex items-center gap-1 justify-center">
                  <input
                    type="text"
                    value={clockInput}
                    onChange={e => setClockInput(e.target.value)}
                    placeholder="MM:SS"
                    autoFocus
                    className="rounded text-center font-mono font-bold w-24 text-lg py-1"
                    style={{
                      backgroundColor: '#ffffff',
                      color: '#111827',
                      caretColor: '#111827',
                      colorScheme: 'light',
                      border: '1px solid rgba(255,255,255,0.4)',
                    }}
                  />
                  <button
                    onClick={saveClockEdit}
                    className="rounded bg-white text-gray-900 font-bold px-2 py-1 text-xs"
                    title="Guardar"
                  >OK</button>
                  <button
                    onClick={() => setEditingClock(false)}
                    className="rounded bg-white/20 text-white font-bold px-2 py-1 text-xs"
                    title="Cancelar"
                  >✕</button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 justify-center">
                  <span
                    onDoubleClick={canEdit ? openClockEdit : undefined}
                    className="font-mono font-bold tabular-nums leading-none select-none text-3xl"
                    style={{
                      color: remainingMs <= 10000 && remainingMs > 0 ? '#fca5a5' : remainingMs === 0 ? '#ef4444' : '#ffffff',
                      cursor: canEdit ? 'pointer' : 'default',
                    }}
                    title={canEdit ? 'Doble click para editar' : undefined}
                  >
                    {mmss}
                  </span>
                  {canEdit && (
                    <>
                      <button
                        onClick={toggleClock}
                        className={`w-8 h-8 rounded font-bold text-sm transition-colors ${
                          running ? 'bg-white text-gray-900' : 'bg-white/25 text-white'
                        }`}
                        title={running ? 'Pausar' : 'Iniciar'}
                      >
                        {running ? '❚❚' : '▶'}
                      </button>
                      <button
                        onClick={openClockEdit}
                        className="w-8 h-8 rounded bg-white/20 text-white font-bold text-xs"
                        title="Editar tiempo"
                      >
                        ✎
                      </button>
                    </>
                  )}
                </div>
              )}
              <p className="opacity-60 leading-none text-xs mt-1">Q{match.quarter || 1}</p>
              <div className="flex gap-1 justify-center mt-1">
                {[1, 2, 3, 4].map(q => (
                  <button
                    key={q}
                    onClick={() => updateQuarter(q)}
                    disabled={!canEdit}
                    className={`w-7 h-7 rounded font-bold text-xs transition-colors ${
                      match.quarter === q ? 'bg-white text-gray-900' : 'bg-white/20 text-white'
                    }`}
                  >
                    {q}
                  </button>
                ))}
                <button
                  onClick={() => updateQuarter(5)}
                  disabled={!canEdit}
                  className={`w-7 h-7 rounded font-bold text-xs transition-colors ${
                    match.quarter === 5 ? 'bg-white text-gray-900' : 'bg-white/20 text-white'
                  }`}
                >
                  OT
                </button>
              </div>
            </div>
            <div className="min-w-0">
              <p className="font-medium opacity-80 truncate text-sm">
                {awayTeam?.name}
              </p>
              <p className="font-bold leading-none text-4xl">{match.awayScore || 0}</p>
            </div>
          </div>
        )}
      </div>

      {/* Columnas de cada equipo */}
      <div className={`flex ${compact ? 'flex-row gap-2' : 'flex-col md:flex-row gap-6'}`}>
        {renderSide('home', homeTeam, onCourtHomePlayers)}
        <div className={`${compact ? 'block' : 'hidden md:block'} w-px`} style={{ backgroundColor: 'var(--color-border)' }} />
        {!compact && <div className="md:hidden h-px" style={{ backgroundColor: 'var(--color-border)' }} />}
        {renderSide('away', awayTeam, onCourtAwayPlayers)}
      </div>
    </div>
  );
}
