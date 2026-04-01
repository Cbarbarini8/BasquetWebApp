import { useState } from 'react';
import { collection, addDoc, doc, updateDoc, deleteDoc, writeBatch, increment, serverTimestamp } from 'firebase/firestore';
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

export default function LiveScoring({ match, events, homePlayers, awayPlayers, homeTeam, awayTeam, canEdit = true, user }) {
  const [selectedPlayer, setSelectedPlayer] = useState({ home: '', away: '' });

  const allPlayers = [...homePlayers, ...awayPlayers];
  const getPlayerLabel = (id) => {
    const p = allPlayers.find(x => x.id === id);
    return p ? `#${p.number} ${p.lastName}` : id;
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

  const renderSide = (side, players, team) => (
    <div className="flex-1 min-w-[280px]">
      <h3 className="font-bold text-lg mb-2 text-center" style={{ color: 'var(--color-text)' }}>
        {team?.name || 'Equipo'}
      </h3>

      {canEdit && <select
        value={selectedPlayer[side]}
        onChange={e => setSelectedPlayer(prev => ({ ...prev, [side]: e.target.value }))}
        className="w-full px-3 py-2 rounded-md text-sm mb-3"
        style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
      >
        <option value="">Seleccionar jugador...</option>
        {players.map(p => (
          <option key={p.id} value={p.id}>#{p.number} {p.firstName} {p.lastName}</option>
        ))}
      </select>}

      {canEdit && <div className="grid grid-cols-3 gap-1.5 mb-4">
        {EVENT_BUTTONS.map((btn, idx) => (
          <button
            key={idx}
            onClick={() => addEvent(side, btn)}
            disabled={!selectedPlayer[side]}
            className="py-2.5 px-1 rounded-md text-white text-xs font-bold disabled:opacity-30 transition-opacity active:scale-95"
            style={{ backgroundColor: btn.color }}
          >
            {btn.label}
          </button>
        ))}
      </div>}

      <div className="space-y-1 max-h-60 overflow-y-auto">
        {events
          .filter(e => e.teamId === (side === 'home' ? match.homeTeamId : match.awayTeamId))
          .map(event => {
            const player = players.find(p => p.id === event.playerId);
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
    </div>
  );

  return (
    <div>
      {/* Scoreboard */}
      <div
        className="rounded-lg p-4 mb-6 text-center"
        style={{ backgroundColor: 'var(--color-table-header)', color: '#ffffff' }}
      >
        <div className="flex items-center justify-center gap-6">
          <div>
            <p className="text-sm font-medium opacity-80">{homeTeam?.name}</p>
            <p className="text-4xl font-bold">{match.homeScore || 0}</p>
          </div>
          <div className="text-center">
            <p className="text-sm opacity-60">Q{match.quarter || 1}</p>
            <div className="flex gap-1 mt-1">
              {[1, 2, 3, 4].map(q => (
                <button
                  key={q}
                  onClick={() => updateQuarter(q)}
                  className={`w-7 h-7 rounded text-xs font-bold transition-colors ${
                    match.quarter === q ? 'bg-white text-gray-900' : 'bg-white/20 text-white'
                  }`}
                >
                  {q}
                </button>
              ))}
              <button
                onClick={() => updateQuarter(5)}
                className={`w-7 h-7 rounded text-xs font-bold transition-colors ${
                  match.quarter === 5 ? 'bg-white text-gray-900' : 'bg-white/20 text-white'
                }`}
              >
                OT
              </button>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium opacity-80">{awayTeam?.name}</p>
            <p className="text-4xl font-bold">{match.awayScore || 0}</p>
          </div>
        </div>
      </div>

      {/* Two columns for each team */}
      <div className="flex flex-col md:flex-row gap-6">
        {renderSide('home', homePlayers, homeTeam)}
        <div className="hidden md:block w-px" style={{ backgroundColor: 'var(--color-border)' }} />
        <div className="md:hidden h-px" style={{ backgroundColor: 'var(--color-border)' }} />
        {renderSide('away', awayPlayers, awayTeam)}
      </div>
    </div>
  );
}
