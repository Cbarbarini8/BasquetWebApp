import { useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, doc, updateDoc, writeBatch, increment, serverTimestamp, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { logAction } from '../../lib/audit';

const EVENT_BUTTONS = [
  { type: '2pt', label: '+2', made: true, points: 2, color: 'var(--color-success)' },
  { type: '2pt', label: '2 Err', made: false, points: 0, color: '#6b7280' },
  { type: '3pt', label: '+3', made: true, points: 3, color: 'var(--color-primary)' },
  { type: '3pt', label: '3 Err', made: false, points: 0, color: '#6b7280' },
  { type: 'ft', label: 'TL', made: true, points: 1, color: 'var(--color-accent)' },
  { type: 'ft', label: 'TL Err', made: false, points: 0, color: '#6b7280' },
  { type: 'foul', label: 'Falta', color: 'var(--color-danger)' },
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
  'assist': 'Asistencia',
  'offRebound': 'Reb. ofensivo',
  'defRebound': 'Reb. defensivo',
  'steal': 'Robo',
  'block': 'Tapon',
  'turnover': 'Perdida',
};

const MAX_ON_COURT = 5;

function PlayerJersey({ player, selected, onClick, compact = false }) {
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
  const [selectedPlayer, setSelectedPlayer] = useState({ home: '', away: '' });
  const [editingCourt, setEditingCourt] = useState({ home: false, away: false });

  const allPlayers = [...homePlayers, ...awayPlayers];
  const getPlayerLabel = (id) => {
    const p = allPlayers.find(x => x.id === id);
    return p ? `#${p.number} ${p.lastName}` : id;
  };

  const onCourtHomeIds = match.onCourtHome || [];
  const onCourtAwayIds = match.onCourtAway || [];

  const onCourtHomePlayers = homePlayers.filter(p => onCourtHomeIds.includes(p.id));
  const onCourtAwayPlayers = awayPlayers.filter(p => onCourtAwayIds.includes(p.id));

  const togglePlayerOnCourt = async (side, playerId) => {
    const field = side === 'home' ? 'onCourtHome' : 'onCourtAway';
    const currentIds = side === 'home' ? onCourtHomeIds : onCourtAwayIds;
    const isOn = currentIds.includes(playerId);
    if (!isOn && currentIds.length >= MAX_ON_COURT) {
      alert(`Maximo ${MAX_ON_COURT} jugadores en cancha. Sacar uno primero.`);
      return;
    }
    await updateDoc(doc(db, 'matches', match.id), {
      [field]: isOn ? arrayRemove(playerId) : arrayUnion(playerId),
    });
  };

  const addEvent = async (side, eventDef) => {
    const playerId = selectedPlayer[side];
    if (!playerId) {
      alert('Selecciona un jugador primero');
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

    await batch.commit();
    if (user) await logAction(user, 'create', 'matchEvents', match.id, `Evento ${eventDef.label}: ${getPlayerLabel(playerId)}`);
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
    if (user) await logAction(user, 'delete', 'matchEvents', match.id, `Deshizo evento: ${getPlayerLabel(event.playerId)}`);
  };

  const updateQuarter = async (q) => {
    await updateDoc(doc(db, 'matches', match.id), { quarter: q });
    if (user) await logAction(user, 'update', 'matches', match.id, `Cambio cuarto a Q${q}`);
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
        className={`rounded-lg text-center ${compact ? 'p-1.5 mb-1.5' : 'p-4 mb-6'}`}
        style={{ backgroundColor: 'var(--color-table-header)', color: '#ffffff' }}
      >
        <div className={`flex items-center justify-center ${compact ? 'gap-3' : 'gap-6'}`}>
          {compact && (
            <Link
              to="/admin"
              className="text-[10px] shrink-0 px-1.5 py-0.5 rounded text-white/80"
              style={{ border: '1px solid rgba(255,255,255,0.3)' }}
              title="Volver"
            >
              ←
            </Link>
          )}
          <div className="min-w-0">
            <p className={`font-medium opacity-80 truncate ${compact ? 'text-[10px] leading-none' : 'text-sm'}`}>
              {homeTeam?.name}
            </p>
            <p className={`font-bold leading-none ${compact ? 'text-2xl' : 'text-4xl'}`}>{match.homeScore || 0}</p>
          </div>
          <div className="text-center shrink-0">
            <p className={`opacity-60 leading-none ${compact ? 'text-[9px]' : 'text-sm'}`}>Q{match.quarter || 1}</p>
            <div className={`flex gap-1 ${compact ? 'mt-0.5' : 'mt-1'}`}>
              {[1, 2, 3, 4].map(q => (
                <button
                  key={q}
                  onClick={() => updateQuarter(q)}
                  className={`rounded font-bold transition-colors ${
                    compact ? 'w-5 h-5 text-[10px]' : 'w-7 h-7 text-xs'
                  } ${match.quarter === q ? 'bg-white text-gray-900' : 'bg-white/20 text-white'}`}
                >
                  {q}
                </button>
              ))}
              <button
                onClick={() => updateQuarter(5)}
                className={`rounded font-bold transition-colors ${
                  compact ? 'w-5 h-5 text-[10px]' : 'w-7 h-7 text-xs'
                } ${match.quarter === 5 ? 'bg-white text-gray-900' : 'bg-white/20 text-white'}`}
              >
                OT
              </button>
            </div>
          </div>
          <div className="min-w-0">
            <p className={`font-medium opacity-80 truncate ${compact ? 'text-[10px] leading-none' : 'text-sm'}`}>
              {awayTeam?.name}
            </p>
            <p className={`font-bold leading-none ${compact ? 'text-2xl' : 'text-4xl'}`}>{match.awayScore || 0}</p>
          </div>
        </div>
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
