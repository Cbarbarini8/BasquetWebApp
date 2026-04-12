import { useState } from 'react';
import TeamLogo from '../common/TeamLogo';
import { useToast } from '../../context/ToastContext';

export default function StartMatchModal({ match, teamsMap, players, onCancel, onConfirm }) {
  const { toast } = useToast();
  const home = teamsMap[match.homeTeamId];
  const away = teamsMap[match.awayTeamId];
  const homePlayers = players.filter(p => p.teamId === match.homeTeamId).sort((a, b) => a.number - b.number);
  const awayPlayers = players.filter(p => p.teamId === match.awayTeamId).sort((a, b) => a.number - b.number);

  const buildInitial = (list) => {
    const map = {};
    list.forEach(p => {
      const existing = match.playerNumbers?.[p.id];
      map[p.id] = String(existing ?? p.number ?? '');
    });
    return map;
  };

  const [numbers, setNumbers] = useState(() => ({
    ...buildInitial(homePlayers),
    ...buildInitial(awayPlayers),
  }));
  // Set de ids de jugadores "quitados" para este partido
  const initialRemoved = () => {
    if (!match.playerNumbers) return new Set();
    const removed = new Set();
    [...homePlayers, ...awayPlayers].forEach(p => {
      if (!(p.id in match.playerNumbers)) removed.add(p.id);
    });
    return removed;
  };
  const [removed, setRemoved] = useState(initialRemoved);
  const [saving, setSaving] = useState(false);

  const update = (id, v) => setNumbers(prev => ({ ...prev, [id]: v.replace(/[^0-9]/g, '').slice(0, 3) }));

  const toggleRemove = (id) => {
    setRemoved(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleConfirm = async () => {
    const checkDupes = (list, teamName) => {
      const seen = {};
      for (const p of list) {
        if (removed.has(p.id)) continue;
        const n = numbers[p.id];
        if (!n) continue;
        if (seen[n]) {
          toast.error(`En ${teamName}: numero ${n} repetido (${seen[n]} y ${p.lastName})`);
          return false;
        }
        seen[n] = p.lastName;
      }
      return true;
    };
    if (!checkDupes(homePlayers, home?.name || 'Local')) return;
    if (!checkDupes(awayPlayers, away?.name || 'Visitante')) return;

    const result = {};
    [...homePlayers, ...awayPlayers].forEach(p => {
      if (removed.has(p.id)) return;
      const n = parseInt(numbers[p.id]);
      if (!isNaN(n)) result[p.id] = n;
    });

    setSaving(true);
    try {
      await onConfirm(result);
    } finally {
      setSaving(false);
    }
  };

  const renderTeam = (team, list) => {
    const active = list.filter(p => !removed.has(p.id));
    const excluded = list.filter(p => removed.has(p.id));
    return (
      <div className="flex-1 min-w-[240px]">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <TeamLogo url={team?.logoUrl} name={team?.name} size={24} />
            <h4 className="font-bold text-sm truncate" style={{ color: 'var(--color-text)' }}>{team?.name || 'Equipo'}</h4>
          </div>
          <span className="text-xs shrink-0" style={{ color: 'var(--color-text-muted)' }}>
            {active.length} en partido
          </span>
        </div>
        <div className="space-y-1 max-h-[45vh] overflow-y-auto pr-1">
          {list.length === 0 && (
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Sin jugadores cargados</p>
          )}
          {active.map(p => (
            <div key={p.id} className="flex items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={numbers[p.id] || ''}
                onChange={e => update(p.id, e.target.value)}
                className="w-14 px-2 py-1 rounded text-sm text-center font-bold"
                style={{
                  backgroundColor: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                }}
              />
              <span className="flex-1 text-sm truncate" style={{ color: 'var(--color-text)' }}>
                {p.firstName} {p.lastName}
              </span>
              <button
                type="button"
                onClick={() => toggleRemove(p.id)}
                className="shrink-0 w-7 h-7 rounded flex items-center justify-center text-base font-bold"
                style={{ color: 'var(--color-danger)', border: '1px solid var(--color-border)' }}
                title="No juega este partido"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        {excluded.length > 0 && (
          <div className="mt-3 pt-2" style={{ borderTop: '1px dashed var(--color-border)' }}>
            <p className="text-[11px] mb-1 font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
              No juegan este partido ({excluded.length})
            </p>
            <div className="space-y-1 max-h-[25vh] overflow-y-auto pr-1">
              {excluded.map(p => (
                <div key={p.id} className="flex items-center gap-2 opacity-70">
                  <span className="flex-1 text-sm truncate line-through" style={{ color: 'var(--color-text-secondary)' }}>
                    #{p.number} {p.firstName} {p.lastName}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleRemove(p.id)}
                    className="shrink-0 text-xs px-2 py-0.5 rounded font-medium"
                    style={{ color: 'var(--color-primary)', border: '1px solid var(--color-primary)' }}
                    title="Volver a incluir"
                  >
                    + Incluir
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={onCancel}
    >
      <div
        className="rounded-lg p-4 w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-base font-bold mb-1" style={{ color: 'var(--color-text)' }}>
          Numeros de jugadores
        </h3>
        <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
          Podes modificar el numero que usa cada jugador en este partido. Dejar vacio para no asignarle numero.
        </p>
        <div className="flex flex-col md:flex-row gap-4">
          {renderTeam(home, homePlayers)}
          <div className="hidden md:block w-px" style={{ backgroundColor: 'var(--color-border)' }} />
          {renderTeam(away, awayPlayers)}
        </div>
        <div className="flex justify-end gap-2 mt-4 pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-3 py-1.5 rounded text-sm"
            style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="px-4 py-1.5 rounded text-sm text-white font-medium disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-success)' }}
          >
            {saving ? 'Iniciando...' : 'Iniciar partido'}
          </button>
        </div>
      </div>
    </div>
  );
}
