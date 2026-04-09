import { useState, useEffect } from 'react';
import { collection, addDoc, doc, updateDoc, deleteDoc, getDocs, serverTimestamp, Timestamp, orderBy, query, writeBatch } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { logAction } from '../../lib/audit';
import { getMatchProximityToNow } from '../../lib/utils';
import { IconButton, EditIcon, DeleteIcon, PlayIcon, StopIcon, CalendarIcon, ClipboardIcon, UndoIcon } from '../common/Icons';

const EVENT_TYPES = [
  { type: 'ft', label: 'TL', made: true },
  { type: '2pt', label: '+2', made: true },
  { type: '3pt', label: '+3', made: true },
  { type: 'foul', label: 'Falta' },
  { type: 'assist', label: 'Asist' },
  { type: 'offRebound', label: 'Reb Of' },
  { type: 'defRebound', label: 'Reb Def' },
  { type: 'steal', label: 'Robo' },
  { type: 'block', label: 'Tapon' },
  { type: 'turnover', label: 'Perdida' },
];

function MatchEditor({ match, teamsMap, courts, allPlayers, onClose, user }) {
  const home = teamsMap[match.homeTeamId]?.name || 'TBD';
  const away = teamsMap[match.awayTeamId]?.name || 'TBD';
  const isFinished = match.status === 'finished';

  const homePlayers = allPlayers.filter(p => p.teamId === match.homeTeamId).sort((a, b) => a.number - b.number);
  const awayPlayers = allPlayers.filter(p => p.teamId === match.awayTeamId).sort((a, b) => a.number - b.number);

  const toDateInputValue = (d) => {
    if (!d) return '';
    const date = d.toDate ? d.toDate() : new Date(d);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  };

  const [date, setDate] = useState(toDateInputValue(match.scheduledDate));
  const [time, setTime] = useState(match.scheduledTime || '');
  const [courtId, setCourtId] = useState(match.courtId || '');
  const [homeScore, setHomeScore] = useState(String(match.homeScore || 0));
  const [awayScore, setAwayScore] = useState(String(match.awayScore || 0));
  const [saving, setSaving] = useState(false);

  // Stats state
  const [showStats, setShowStats] = useState(false);
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [addPlayerSide, setAddPlayerSide] = useState('');
  const [addPlayerId, setAddPlayerId] = useState('');
  const [addQuarter, setAddQuarter] = useState(1);
  const [addEventType, setAddEventType] = useState('');

  useEffect(() => {
    if (!showStats) return;
    setEventsLoading(true);
    getDocs(query(collection(db, `matches/${match.id}/events`), orderBy('timestamp', 'desc')))
      .then(snap => setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(console.error)
      .finally(() => setEventsLoading(false));
  }, [showStats]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = {
        scheduledDate: date ? Timestamp.fromDate(new Date(date + 'T00:00:00')) : null,
        scheduledTime: time,
        courtId: courtId || null,
      };
      if (isFinished) {
        data.homeScore = parseInt(homeScore) || 0;
        data.awayScore = parseInt(awayScore) || 0;
      }
      await updateDoc(doc(db, 'matches', match.id), data);
      await logAction(user, 'update', 'matches', match.id, `Edito partido: ${home} vs ${away}`);
      onClose();
    } catch (err) {
      console.error('Error updating match:', err);
      alert('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleAddEvent = async (evtDef) => {
    if (!addPlayerId) return;

    const teamId = addPlayerSide === 'home' ? match.homeTeamId : match.awayTeamId;
    const eventData = {
      type: evtDef.type,
      playerId: addPlayerId,
      teamId,
      quarter: addQuarter,
      timestamp: serverTimestamp(),
    };
    if (evtDef.made !== undefined) eventData.made = evtDef.made;

    const ref = await addDoc(collection(db, `matches/${match.id}/events`), eventData);
    setEvents(prev => [{ id: ref.id, ...eventData, timestamp: new Date() }, ...prev]);
    if (user) await logAction(user, 'create', 'matchEvents', match.id, `Evento ${evtDef.label}: ${getPlayerName(addPlayerId)} (${home} vs ${away})`);
  };

  const handleDeleteEvent = async (eventId) => {
    const evt = events.find(e => e.id === eventId);
    await deleteDoc(doc(db, `matches/${match.id}/events`, eventId));
    setEvents(prev => prev.filter(e => e.id !== eventId));
    if (user && evt) await logAction(user, 'delete', 'matchEvents', match.id, `Elimino evento: ${getPlayerName(evt.playerId)} (${home} vs ${away})`);
  };

  const handleClearAll = async () => {
    if (!window.confirm(`Eliminar TODAS las estadisticas de este partido (${events.length} eventos)?`)) return;
    const batch = writeBatch(db);
    events.forEach(e => batch.delete(doc(db, `matches/${match.id}/events`, e.id)));
    await batch.commit();
    await logAction(user, 'delete', 'matches', match.id, `Limpio estadisticas: ${home} vs ${away} (${events.length} eventos)`);
    setEvents([]);
  };

  const getPlayerName = (playerId) => {
    const p = allPlayers.find(x => x.id === playerId);
    return p ? `#${p.number} ${p.lastName}` : playerId;
  };

  const getEventLabel = (event) => {
    const def = EVENT_TYPES.find(e => e.type === event.type);
    return def?.label || event.type;
  };

  // Group events by team and player for summary
  const eventSummary = (teamId) => {
    const teamEvents = events.filter(e => e.teamId === teamId);
    const byPlayer = {};
    teamEvents.forEach(e => {
      if (!byPlayer[e.playerId]) byPlayer[e.playerId] = [];
      byPlayer[e.playerId].push(e);
    });
    return Object.entries(byPlayer).map(([playerId, evts]) => ({
      playerId,
      name: getPlayerName(playerId),
      count: evts.length,
      points: evts.filter(e => ['2pt', '3pt', 'ft'].includes(e.type) && e.made).reduce((sum, e) => sum + (e.type === '3pt' ? 3 : e.type === '2pt' ? 2 : 1), 0),
      events: evts,
    })).sort((a, b) => b.points - a.points);
  };

  const inputStyle = { backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text)' };

  return (
    <div
      className="p-3 rounded-md mt-2 space-y-3"
      style={{ backgroundColor: 'var(--color-bg-hover)', border: '1px solid var(--color-border)' }}
    >
      <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
        {home} vs {away}
      </p>

      {isFinished && (
        <div className="flex gap-2 items-end">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Pts {home}</label>
            <input type="number" min="0" value={homeScore} onChange={e => setHomeScore(e.target.value)}
              className="w-20 px-3 py-1.5 rounded-md text-sm" style={inputStyle} />
          </div>
          <span className="pb-1.5 font-bold" style={{ color: 'var(--color-text-muted)' }}>-</span>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Pts {away}</label>
            <input type="number" min="0" value={awayScore} onChange={e => setAwayScore(e.target.value)}
              className="w-20 px-3 py-1.5 rounded-md text-sm" style={inputStyle} />
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Dia</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="px-3 py-1.5 rounded-md text-sm" style={inputStyle} />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Horario</label>
          <input type="time" value={time} onChange={e => setTime(e.target.value)}
            className="px-3 py-1.5 rounded-md text-sm" style={inputStyle} />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Cancha</label>
          <select value={courtId} onChange={e => setCourtId(e.target.value)}
            className="px-3 py-1.5 rounded-md text-sm" style={inputStyle}>
            <option value="">Sin cancha</option>
            {courts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={handleSave} disabled={saving}
          className="text-xs px-3 py-1.5 rounded text-white font-medium disabled:opacity-50"
          style={{ backgroundColor: 'var(--color-btn-primary)' }}>
          {saving ? 'Guardando...' : 'Guardar datos'}
        </button>
        <button onClick={() => setShowStats(!showStats)}
          className="text-xs px-3 py-1.5 rounded font-medium"
          style={{ color: 'var(--color-primary)', border: '1px solid var(--color-primary)' }}>
          {showStats ? 'Ocultar estadisticas' : 'Estadisticas'}
        </button>
        <button onClick={onClose} className="text-xs px-3 py-1.5 rounded"
          style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}>
          Cancelar
        </button>
      </div>

      {/* Stats section */}
      {showStats && (
        <div className="pt-3 space-y-4" style={{ borderTop: '1px solid var(--color-border)' }}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-primary)' }}>
              Estadisticas ({events.length} eventos)
            </p>
            {events.length > 0 && (
              <button onClick={handleClearAll}
                className="text-xs px-2 py-1 rounded cursor-pointer font-medium"
                style={{ color: 'var(--color-danger)', border: '1px solid var(--color-danger)' }}>
                Limpiar todo
              </button>
            )}
          </div>

          {/* Add event */}
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <select value={addPlayerSide} onChange={e => { setAddPlayerSide(e.target.value); setAddPlayerId(''); }}
                className="px-2 py-1.5 rounded-md text-xs" style={inputStyle}>
                <option value="">Equipo...</option>
                <option value="home">{home}</option>
                <option value="away">{away}</option>
              </select>
              <select value={addPlayerId} onChange={e => setAddPlayerId(e.target.value)}
                className="flex-1 min-w-[180px] px-2 py-1.5 rounded-md text-xs" style={inputStyle} disabled={!addPlayerSide}>
                <option value="">Seleccionar jugador...</option>
                {(addPlayerSide === 'home' ? homePlayers : addPlayerSide === 'away' ? awayPlayers : []).map(p => (
                  <option key={p.id} value={p.id}>#{p.number} {p.firstName} {p.lastName}</option>
                ))}
              </select>
              <select value={addQuarter} onChange={e => setAddQuarter(parseInt(e.target.value))}
                className="px-2 py-1.5 rounded-md text-xs" style={inputStyle}>
                <option value={1}>Q1</option>
                <option value={2}>Q2</option>
                <option value={3}>Q3</option>
                <option value={4}>Q4</option>
                <option value={5}>OT</option>
              </select>
            </div>
            {addPlayerId && (
              <div className="flex flex-wrap gap-1">
                {EVENT_TYPES.map(evt => (
                  <button key={evt.type} onClick={() => handleAddEvent(evt)}
                    className="text-xs px-2.5 py-1.5 rounded font-medium text-white active:scale-95 transition-transform"
                    style={{ backgroundColor: ['ft', '2pt', '3pt'].includes(evt.type) ? 'var(--color-success)' : evt.type === 'foul' ? 'var(--color-danger)' : 'var(--color-primary)' }}>
                    {evt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {eventsLoading ? (
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Cargando...</p>
          ) : events.length === 0 ? (
            <p className="text-xs text-center py-4" style={{ color: 'var(--color-text-muted)' }}>
              Sin estadisticas cargadas
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Home team summary */}
              <div>
                <p className="text-xs font-bold mb-2" style={{ color: 'var(--color-text)' }}>{home}</p>
                {eventSummary(match.homeTeamId).map(ps => (
                  <div key={ps.playerId} className="mb-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>
                        {ps.name} — {ps.points} pts
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {ps.events.map(evt => (
                        <button key={evt.id} onClick={() => handleDeleteEvent(evt.id)}
                          className="text-xs px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
                          title="Click para eliminar">
                          {getEventLabel(evt)} Q{evt.quarter || 1} x
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {/* Away team summary */}
              <div>
                <p className="text-xs font-bold mb-2" style={{ color: 'var(--color-text)' }}>{away}</p>
                {eventSummary(match.awayTeamId).map(ps => (
                  <div key={ps.playerId} className="mb-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>
                        {ps.name} — {ps.points} pts
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {ps.events.map(evt => (
                        <button key={evt.id} onClick={() => handleDeleteEvent(evt.id)}
                          className="text-xs px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
                          title="Click para eliminar">
                          {getEventLabel(evt)} Q{evt.quarter || 1} x
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ManualMatchForm({ teams, courts, seasonId, onClose }) {
  const [round, setRound] = useState('');
  const [homeTeamId, setHomeTeamId] = useState('');
  const [awayTeamId, setAwayTeamId] = useState('');
  const [status, setStatus] = useState('scheduled');
  const [homeScore, setHomeScore] = useState('');
  const [awayScore, setAwayScore] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [courtId, setCourtId] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!homeTeamId || !awayTeamId || !round) return;
    if (homeTeamId === awayTeamId) {
      alert('Los equipos deben ser diferentes');
      return;
    }

    setSaving(true);
    try {
      const isFinished = status === 'finished';
      await addDoc(collection(db, 'matches'), {
        round: parseInt(round),
        homeTeamId,
        awayTeamId,
        homeScore: isFinished ? parseInt(homeScore) || 0 : 0,
        awayScore: isFinished ? parseInt(awayScore) || 0 : 0,
        status,
        scheduledDate: date ? Timestamp.fromDate(new Date(date + 'T00:00:00')) : null,
        scheduledTime: time,
        courtId: courtId || null,
        quarter: isFinished ? 4 : 0,
        seasonId: seasonId || null,
        createdAt: serverTimestamp(),
        startedAt: isFinished ? serverTimestamp() : null,
        finishedAt: isFinished ? serverTimestamp() : null,
      });

      setRound('');
      setHomeTeamId('');
      setAwayTeamId('');
      setStatus('scheduled');
      setHomeScore('');
      setAwayScore('');
      setDate('');
      setTime('');
      setCourtId('');
    } catch (err) {
      console.error('Error creating match:', err);
      alert('Error al crear el partido');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="p-4 rounded-lg mb-6"
      style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>
          Agregar partido manual
        </h3>
        <button onClick={onClose} className="text-xs px-2 py-1 rounded" style={{ color: 'var(--color-text-muted)' }}>
          Cerrar
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Fecha (ronda)</label>
            <input
              type="number" min="1" placeholder="#" value={round} onChange={e => setRound(e.target.value)} required
              className="w-20 px-3 py-2 rounded-md text-sm"
              style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Local</label>
            <select value={homeTeamId} onChange={e => setHomeTeamId(e.target.value)} required
              className="w-full px-3 py-2 rounded-md text-sm"
              style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
            >
              <option value="">Equipo local...</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Visitante</label>
            <select value={awayTeamId} onChange={e => setAwayTeamId(e.target.value)} required
              className="w-full px-3 py-2 rounded-md text-sm"
              style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
            >
              <option value="">Equipo visitante...</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Dia</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="px-3 py-2 rounded-md text-sm"
              style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
            />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Horario</label>
            <input type="time" value={time} onChange={e => setTime(e.target.value)}
              className="px-3 py-2 rounded-md text-sm"
              style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
            />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Cancha</label>
            <select value={courtId} onChange={e => setCourtId(e.target.value)}
              className="px-3 py-2 rounded-md text-sm"
              style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
            >
              <option value="">Sin cancha</option>
              {courts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Estado</label>
            <select value={status} onChange={e => setStatus(e.target.value)}
              className="px-3 py-2 rounded-md text-sm"
              style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
            >
              <option value="scheduled">Programado</option>
              <option value="finished">Finalizado</option>
            </select>
          </div>
        </div>

        {status === 'finished' && (
          <div className="flex gap-2 items-end">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Pts Local</label>
              <input type="number" min="0" value={homeScore} onChange={e => setHomeScore(e.target.value)} required
                className="w-20 px-3 py-2 rounded-md text-sm"
                style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
              />
            </div>
            <span className="pb-2 font-bold" style={{ color: 'var(--color-text-muted)' }}>-</span>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Pts Visitante</label>
              <input type="number" min="0" value={awayScore} onChange={e => setAwayScore(e.target.value)} required
                className="w-20 px-3 py-2 rounded-md text-sm"
                style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
              />
            </div>
          </div>
        )}

        <button type="submit" disabled={saving}
          className="px-4 py-2 rounded-md text-white text-sm font-medium disabled:opacity-50"
          style={{ backgroundColor: 'var(--color-btn-primary)' }}
        >
          {saving ? 'Guardando...' : 'Agregar partido'}
        </button>
      </form>
    </div>
  );
}

function formatMatchDate(d) {
  if (!d) return '';
  const date = d.toDate ? d.toDate() : new Date(d);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function MatchManager({ matches, teamsMap, teams, players, courts, courtsMap, seasonId, canEdit, canScoring, user }) {
  const navigate = useNavigate();
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const getMatchLabel = (matchId) => {
    const m = matches.find(x => x.id === matchId);
    if (!m) return matchId;
    const h = teamsMap[m.homeTeamId]?.name || 'TBD';
    const a = teamsMap[m.awayTeamId]?.name || 'TBD';
    return `${h} vs ${a}`;
  };

  const startMatch = async (matchId) => {
    await updateDoc(doc(db, 'matches', matchId), {
      status: 'live',
      quarter: 1,
      homeScore: 0,
      awayScore: 0,
      startedAt: serverTimestamp(),
    });
    await logAction(user, 'start', 'matches', matchId, `Inicio partido: ${getMatchLabel(matchId)}`);
  };

  const finishMatch = async (matchId) => {
    if (!window.confirm('Finalizar este partido?')) return;
    await updateDoc(doc(db, 'matches', matchId), {
      status: 'finished',
      finishedAt: serverTimestamp(),
    });
    await logAction(user, 'finish', 'matches', matchId, `Finalizo partido: ${getMatchLabel(matchId)}`);
  };

  const resetMatch = async (matchId) => {
    if (!window.confirm('Resetear este partido a programado? Se eliminaran todas las estadisticas cargadas.')) return;
    const eventsSnap = await getDocs(collection(db, `matches/${matchId}/events`));
    const batch = writeBatch(db);
    eventsSnap.docs.forEach(d => batch.delete(d.ref));
    batch.update(doc(db, 'matches', matchId), {
      status: 'scheduled',
      homeScore: 0,
      awayScore: 0,
      quarter: 0,
      startedAt: null,
      finishedAt: null,
      onCourtHome: [],
      onCourtAway: [],
    });
    await batch.commit();
    await logAction(user, 'reset', 'matches', matchId, `Reseteo partido: ${getMatchLabel(matchId)} (${eventsSnap.size} eventos eliminados)`);
  };

  const deleteMatch = async (matchId) => {
    if (!window.confirm('Eliminar este partido?')) return;
    const label = getMatchLabel(matchId);
    await deleteDoc(doc(db, 'matches', matchId));
    await logAction(user, 'delete', 'matches', matchId, `Elimino partido: ${label}`);
  };

  const getMatchSortValue = (m) => {
    if (!m.scheduledDate) return Infinity;
    const d = m.scheduledDate.toDate ? m.scheduledDate.toDate() : new Date(m.scheduledDate);
    const time = m.scheduledTime ? m.scheduledTime.replace(':', '') : '9999';
    return d.getTime() * 100000 + parseInt(time);
  };

  const groupedByRound = {};
  matches.forEach(m => {
    const r = m.round || 1;
    if (!groupedByRound[r]) groupedByRound[r] = [];
    groupedByRound[r].push(m);
  });

  const roundNumbers = Object.keys(groupedByRound).map(Number).sort((a, b) => b - a);
  const pendingRoundNumbers = roundNumbers.filter(r => groupedByRound[r].some(m => m.status !== 'finished'));
  const completedRoundNumbers = roundNumbers.filter(r => groupedByRound[r].every(m => m.status === 'finished'));

  // Pendientes: orden cronologico ascendente (fecha+hora menor a mayor)
  const now = Date.now();
  pendingRoundNumbers.forEach(r => {
    groupedByRound[r].sort((a, b) => getMatchSortValue(a) - getMatchSortValue(b));
  });
  // Completadas: orden cronologico descendente (fecha+hora mayor a menor)
  completedRoundNumbers.forEach(r => {
    groupedByRound[r].sort((a, b) => getMatchSortValue(b) - getMatchSortValue(a));
  });

  // Encabezados de fechas pendientes ordenados por la proximidad de su partido mas cercano
  const getRoundProximity = (round) => {
    let minDistance = Infinity;
    groupedByRound[round].forEach(m => {
      const d = getMatchProximityToNow(m, now);
      if (d < minDistance) minDistance = d;
    });
    return minDistance;
  };
  pendingRoundNumbers.sort((a, b) => getRoundProximity(a) - getRoundProximity(b));

  return (
    <div>
      {canEdit && (showForm ? (
        <ManualMatchForm
          teams={teams || Object.values(teamsMap)}
          courts={courts || []}
          seasonId={seasonId}
          onClose={() => setShowForm(false)}
        />
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="mb-6 px-4 py-2 rounded-md text-white text-sm font-medium"
          style={{ backgroundColor: 'var(--color-btn-primary)' }}
        >
          + Agregar partido manual
        </button>
      ))}

      <div className="space-y-6">
        {pendingRoundNumbers.map(round => renderRound(round))}

        {completedRoundNumbers.length > 0 && (
          <div>
            <h2
              className="text-xs font-bold uppercase tracking-widest mt-2 mb-4 pb-2"
              style={{
                color: 'var(--color-text-muted)',
                borderBottom: '1px solid var(--color-border)',
              }}
            >
              Fechas completadas
            </h2>
            <div className="space-y-6">
              {completedRoundNumbers.map(round => renderRound(round))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  function renderRound(round) {
    return (
      <div key={round}>
        <h3 className="text-sm font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--color-primary)' }}>
          Fecha {round}
        </h3>
        <div className="space-y-2">
          {groupedByRound[round].map(match => {
            const home = teamsMap[match.homeTeamId]?.name || 'TBD';
            const away = teamsMap[match.awayTeamId]?.name || 'TBD';
            const court = match.courtId ? courtsMap?.[match.courtId] : null;
            const dateStr = formatMatchDate(match.scheduledDate);
            const scheduleLabel = dateStr
              ? `${dateStr} ${match.scheduledTime || ''}`
              : 'Sin fecha asignada';

            return (
              <div key={match.id}>
                <div
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 rounded-md"
                  style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>
                      {home} vs {away}
                    </span>
                    {court && (
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {court.name}
                      </span>
                    )}
                    {match.status === 'live' && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: 'var(--color-live)' }}>
                        EN VIVO {match.homeScore}-{match.awayScore}
                      </span>
                    )}
                    {match.status === 'finished' && (
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        Final: {match.homeScore}-{match.awayScore}
                      </span>
                    )}
                    {match.status === 'scheduled' && (
                      <span className="text-xs" style={{ color: dateStr ? 'var(--color-text-muted)' : 'var(--color-warning)' }}>
                        {scheduleLabel}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1 flex-wrap items-center">
                    {canEdit && match.status === 'scheduled' && (
                      <>
                        <IconButton icon={CalendarIcon} label={editingId === match.id ? 'Cerrar' : 'Programar'} onClick={() => setEditingId(editingId === match.id ? null : match.id)} />
                        <IconButton icon={PlayIcon} label="Iniciar" onClick={() => startMatch(match.id)} color="var(--color-success)" />
                      </>
                    )}
                    {match.status === 'live' && (canEdit || canScoring) && (
                      <>
                        <IconButton icon={ClipboardIcon} label="Planilla" onClick={() => navigate(`/admin/match/${match.id}`)} />
                        {canEdit && <IconButton icon={StopIcon} label="Finalizar" onClick={() => finishMatch(match.id)} color="var(--color-warning)" />}
                      </>
                    )}
                    {canEdit && match.status === 'finished' && (
                      <IconButton icon={EditIcon} label={editingId === match.id ? 'Cerrar' : 'Editar'} onClick={() => setEditingId(editingId === match.id ? null : match.id)} />
                    )}
                    {canEdit && match.status !== 'finished' && (
                      <IconButton icon={UndoIcon} label="Reset" onClick={() => resetMatch(match.id)} color="var(--color-text-muted)" />
                    )}
                    {canEdit && (
                      <IconButton icon={DeleteIcon} label="Eliminar" onClick={() => deleteMatch(match.id)} color="var(--color-danger)" />
                    )}
                  </div>
                </div>

                {editingId === match.id && (
                  <MatchEditor
                    match={match}
                    teamsMap={teamsMap}
                    courts={courts || []}
                    allPlayers={players || []}
                    user={user}
                    onClose={() => setEditingId(null)}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }
}
