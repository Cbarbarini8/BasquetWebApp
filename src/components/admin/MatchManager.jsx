import { useState } from 'react';
import { collection, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../../lib/firebase';

function MatchEditor({ match, teamsMap, courts, onClose }) {
  const home = teamsMap[match.homeTeamId]?.name || 'TBD';
  const away = teamsMap[match.awayTeamId]?.name || 'TBD';
  const isFinished = match.status === 'finished';

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
      onClose();
    } catch (err) {
      console.error('Error updating match:', err);
      alert('Error al guardar');
    } finally {
      setSaving(false);
    }
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
      <div className="flex gap-2">
        <button onClick={handleSave} disabled={saving}
          className="text-xs px-3 py-1.5 rounded text-white font-medium disabled:opacity-50"
          style={{ backgroundColor: 'var(--color-btn-primary)' }}>
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
        <button onClick={onClose} className="text-xs px-3 py-1.5 rounded"
          style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}>
          Cancelar
        </button>
      </div>
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

export default function MatchManager({ matches, teamsMap, teams, courts, courtsMap, seasonId }) {
  const navigate = useNavigate();
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const startMatch = async (matchId) => {
    await updateDoc(doc(db, 'matches', matchId), {
      status: 'live',
      quarter: 1,
      homeScore: 0,
      awayScore: 0,
      startedAt: serverTimestamp(),
    });
  };

  const finishMatch = async (matchId) => {
    if (!window.confirm('Finalizar este partido?')) return;
    await updateDoc(doc(db, 'matches', matchId), {
      status: 'finished',
      finishedAt: serverTimestamp(),
    });
  };

  const resetMatch = async (matchId) => {
    if (!window.confirm('Resetear este partido a programado?')) return;
    await updateDoc(doc(db, 'matches', matchId), {
      status: 'scheduled',
      homeScore: 0,
      awayScore: 0,
      quarter: 0,
      startedAt: null,
      finishedAt: null,
    });
  };

  const deleteMatch = async (matchId) => {
    if (!window.confirm('Eliminar este partido?')) return;
    await deleteDoc(doc(db, 'matches', matchId));
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
  Object.values(groupedByRound).forEach(arr => arr.sort((a, b) => getMatchSortValue(a) - getMatchSortValue(b)));

  const roundNumbers = Object.keys(groupedByRound).map(Number).sort((a, b) => a - b);

  return (
    <div>
      {showForm ? (
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
      )}

      <div className="space-y-6">
        {roundNumbers.map(round => (
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
                      <div className="flex gap-1 flex-wrap">
                        {match.status === 'scheduled' && (
                          <>
                            <button
                              onClick={() => setEditingId(editingId === match.id ? null : match.id)}
                              className="text-xs px-3 py-1 rounded cursor-pointer font-medium"
                              style={{ color: 'var(--color-primary)', border: '1px solid var(--color-primary)' }}
                            >
                              {editingId === match.id ? 'Cerrar' : 'Programar'}
                            </button>
                            <button onClick={() => startMatch(match.id)} className="text-xs px-3 py-1 rounded text-white cursor-pointer font-medium" style={{ backgroundColor: 'var(--color-success)' }}>
                              Iniciar
                            </button>
                          </>
                        )}
                        {match.status === 'live' && (
                          <>
                            <button onClick={() => navigate(`/admin/match/${match.id}`)} className="text-xs px-3 py-1 rounded text-white cursor-pointer font-medium" style={{ backgroundColor: 'var(--color-primary)' }}>
                              Planilla
                            </button>
                            <button onClick={() => finishMatch(match.id)} className="text-xs px-3 py-1 rounded text-white cursor-pointer font-medium" style={{ backgroundColor: 'var(--color-warning)' }}>
                              Finalizar
                            </button>
                          </>
                        )}
                        {match.status === 'finished' && (
                          <button
                            onClick={() => setEditingId(editingId === match.id ? null : match.id)}
                            className="text-xs px-3 py-1 rounded cursor-pointer font-medium"
                            style={{ color: 'var(--color-primary)', border: '1px solid var(--color-primary)' }}
                          >
                            {editingId === match.id ? 'Cerrar' : 'Editar'}
                          </button>
                        )}
                        {match.status !== 'finished' && (
                          <button onClick={() => resetMatch(match.id)} className="text-xs px-3 py-1 rounded cursor-pointer font-medium" style={{ color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
                            Reset
                          </button>
                        )}
                        <button onClick={() => deleteMatch(match.id)} className="text-xs px-3 py-1 rounded cursor-pointer font-medium" style={{ color: 'var(--color-danger)', border: '1px solid var(--color-danger)' }}>
                          Eliminar
                        </button>
                      </div>
                    </div>

                    {editingId === match.id && (
                      <MatchEditor
                        match={match}
                        teamsMap={teamsMap}
                        courts={courts || []}
                        onClose={() => setEditingId(null)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
