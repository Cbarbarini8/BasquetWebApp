import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import TeamLogo from '../common/TeamLogo';
import { useToast } from '../../context/ToastContext';
import { computeActiveSuspensionsForTeam, findRecentFinishedMatches } from '../../lib/suspensions';
import {
  MAX_ROSTER_SIZE,
  MAX_LIBRES_PER_MATCH,
  deriveLibreHistory,
  checkLibreEligibility,
} from '../../lib/roster';
import { seasonYearFrom } from '../../lib/playerCategory';

export default function StartMatchModal({ match, teamsMap, players, allMatches = [], onCancel, onConfirm }) {
  const { toast } = useToast();
  // Anio del torneo para resolver categorias por anio de nacimiento.
  const seasonYear = seasonYearFrom(match.scheduledDate);
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
  const [captains, setCaptains] = useState(() => ({
    home: match.homeCaptainId || '',
    away: match.awayCaptainId || '',
  }));
  // Set de playerIds marcados como libres en este partido.
  const [libreIds, setLibreIds] = useState(() => {
    const initial = new Set();
    (match.libres?.home || []).forEach(id => initial.add(id));
    (match.libres?.away || []).forEach(id => initial.add(id));
    return initial;
  });
  const [saving, setSaving] = useState(false);

  // Historial de libres derivado de todos los matches (para validar cruces
  // entre equipos y la regla "sin libres nuevos en semis/final").
  const libreHistory = useMemo(() => deriveLibreHistory(allMatches), [allMatches]);
  // { [playerId]: { reason, fromMatchId, fromMatchRound, remaining } }
  const [suspended, setSuspended] = useState({});
  const [loadingSuspensions, setLoadingSuspensions] = useState(true);

  // Detectar jugadores suspendidos a partir de los partidos previos del equipo
  useEffect(() => {
    let cancelled = false;
    async function loadSuspensions() {
      setLoadingSuspensions(true);
      const result = {};
      for (const teamId of [match.homeTeamId, match.awayTeamId]) {
        const recent = findRecentFinishedMatches(allMatches, match, teamId);
        if (recent.length === 0) continue;
        try {
          const eventsByMatchId = {};
          for (const m of recent) {
            const snap = await getDocs(collection(db, `matches/${m.id}/events`));
            eventsByMatchId[m.id] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          }
          const susps = computeActiveSuspensionsForTeam(match, recent, eventsByMatchId, teamId);
          Object.entries(susps).forEach(([pid, info]) => {
            const player = players.find(p => p.id === pid);
            if (!player || player.teamId !== teamId) return;
            result[pid] = info;
          });
        } catch (err) {
          console.error('Error cargando suspensiones:', err);
        }
      }
      if (!cancelled) {
        setSuspended(result);
        setLoadingSuspensions(false);
      }
    }
    loadSuspensions();
    return () => { cancelled = true; };
  }, [match.id, match.homeTeamId, match.awayTeamId, allMatches, players]); // eslint-disable-line react-hooks/exhaustive-deps

  // Excluir automaticamente a los suspendidos solo la primera vez que se
  // configura el partido (si ya existia playerNumbers, respetamos la decision
  // manual previa del admin).
  useEffect(() => {
    if (loadingSuspensions) return;
    if (match.playerNumbers) return;
    const ids = Object.keys(suspended);
    if (ids.length === 0) return;
    setRemoved(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.add(id));
      return next;
    });
  }, [suspended, loadingSuspensions, match.playerNumbers]);

  const update = (id, v) => setNumbers(prev => ({ ...prev, [id]: v.replace(/[^0-9]/g, '').slice(0, 3) }));

  const toggleRemove = (id) => {
    setRemoved(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    // Si quitan al jugador que era capitan, limpiar capitania
    setCaptains(prev => {
      if (prev.home === id) return { ...prev, home: '' };
      if (prev.away === id) return { ...prev, away: '' };
      return prev;
    });
    // Y limpiar marca de libre si la tenia.
    setLibreIds(prev => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const setCaptain = (side, playerId) => {
    setCaptains(prev => ({ ...prev, [side]: prev[side] === playerId ? '' : playerId }));
  };

  // Toggle libre con validacion en el momento (asi el admin recibe feedback
  // inmediato cuando intenta marcar un jugador inelegible).
  const toggleLibre = (player, teamId) => {
    const id = player.id;
    if (libreIds.has(id)) {
      setLibreIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      return;
    }
    const phase = match.phase || 'regular';
    const playerHistory = libreHistory[id] || [];
    const elig = checkLibreEligibility(player, teamId, phase, playerHistory, match.id, seasonYear);
    if (!elig.ok) {
      toast.warning(`${player.firstName} ${player.lastName}: ${elig.reason}`, 5000);
      return;
    }
    setLibreIds(prev => {
      const next = new Set(prev);
      next.add(id);
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

    // Cap de plantel: 12 convocados (titulares + suplentes) por equipo.
    const homeActive = homePlayers.filter(p => !removed.has(p.id));
    const awayActive = awayPlayers.filter(p => !removed.has(p.id));
    if (homeActive.length > MAX_ROSTER_SIZE) {
      toast.error(`${home?.name || 'Local'}: ${homeActive.length} convocados (maximo ${MAX_ROSTER_SIZE}). Excluya jugadores con ✕.`);
      return;
    }
    if (awayActive.length > MAX_ROSTER_SIZE) {
      toast.error(`${away?.name || 'Visitante'}: ${awayActive.length} convocados (maximo ${MAX_ROSTER_SIZE}). Excluya jugadores con ✕.`);
      return;
    }

    // Cap de libres: 3 por equipo. Validacion final por si cambio el plantel
    // despues de marcar libres.
    const homeLibres = homeActive.filter(p => libreIds.has(p.id));
    const awayLibres = awayActive.filter(p => libreIds.has(p.id));
    if (homeLibres.length > MAX_LIBRES_PER_MATCH) {
      toast.error(`${home?.name || 'Local'}: ${homeLibres.length} libres (maximo ${MAX_LIBRES_PER_MATCH}).`);
      return;
    }
    if (awayLibres.length > MAX_LIBRES_PER_MATCH) {
      toast.error(`${away?.name || 'Visitante'}: ${awayLibres.length} libres (maximo ${MAX_LIBRES_PER_MATCH}).`);
      return;
    }
    // Re-validar elegibilidad de cada libre (por si la fase del partido cambio
    // despues de marcarlos).
    const phase = match.phase || 'regular';
    for (const { p, teamId, teamName } of [
      ...homeLibres.map(p => ({ p, teamId: match.homeTeamId, teamName: home?.name || 'Local' })),
      ...awayLibres.map(p => ({ p, teamId: match.awayTeamId, teamName: away?.name || 'Visitante' })),
    ]) {
      const elig = checkLibreEligibility(p, teamId, phase, libreHistory[p.id] || [], match.id, seasonYear);
      if (!elig.ok) {
        toast.error(`${teamName}: ${p.firstName} ${p.lastName} no es libre elegible (${elig.reason}).`);
        return;
      }
    }

    if (!captains.home) {
      toast.error(`Asigna un capitan a ${home?.name || 'Local'}`);
      return;
    }
    if (!captains.away) {
      toast.error(`Asigna un capitan a ${away?.name || 'Visitante'}`);
      return;
    }
    if (removed.has(captains.home)) {
      toast.error(`El capitan de ${home?.name || 'Local'} esta excluido del partido`);
      return;
    }
    if (removed.has(captains.away)) {
      toast.error(`El capitan de ${away?.name || 'Visitante'} esta excluido del partido`);
      return;
    }

    const result = {};
    [...homePlayers, ...awayPlayers].forEach(p => {
      if (removed.has(p.id)) return;
      const n = parseInt(numbers[p.id]);
      if (!isNaN(n)) result[p.id] = n;
    });

    const libresPayload = {
      home: homeLibres.map(p => p.id),
      away: awayLibres.map(p => p.id),
    };

    setSaving(true);
    try {
      await onConfirm(
        result,
        { homeCaptainId: captains.home, awayCaptainId: captains.away },
        libresPayload,
      );
    } finally {
      setSaving(false);
    }
  };

  const renderTeam = (side, team, list) => {
    const captainId = captains[side];
    const active = list.filter(p => !removed.has(p.id));
    const excluded = list.filter(p => removed.has(p.id));
    const teamSuspendedIncluded = active.filter(p => suspended[p.id]);
    const teamId = side === 'home' ? match.homeTeamId : match.awayTeamId;
    const libresActive = active.filter(p => libreIds.has(p.id));
    const overRoster = active.length > MAX_ROSTER_SIZE;
    const overLibres = libresActive.length > MAX_LIBRES_PER_MATCH;
    return (
      <div className="flex-1 min-w-[240px]">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <TeamLogo url={team?.logoUrl} name={team?.name} size={24} />
            <h4 className="font-bold text-sm truncate" style={{ color: 'var(--color-text)' }}>{team?.name || 'Equipo'}</h4>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className="text-xs px-1.5 py-0.5 rounded font-medium"
              style={{
                color: overRoster ? '#ffffff' : 'var(--color-text-muted)',
                backgroundColor: overRoster ? 'var(--color-danger)' : 'var(--color-bg-hover)',
              }}
              title={`Plantel del partido (max ${MAX_ROSTER_SIZE})`}
            >
              {active.length}/{MAX_ROSTER_SIZE}
            </span>
            <span
              className="text-xs px-1.5 py-0.5 rounded font-medium"
              style={{
                color: overLibres ? '#ffffff' : 'var(--color-text-muted)',
                backgroundColor: overLibres ? 'var(--color-danger)' : 'var(--color-bg-hover)',
              }}
              title={`Libres (max ${MAX_LIBRES_PER_MATCH})`}
            >
              L {libresActive.length}/{MAX_LIBRES_PER_MATCH}
            </span>
          </div>
        </div>
        <div className="text-[11px] mb-2 px-2 py-1 rounded flex items-center gap-1"
          style={{
            backgroundColor: captainId ? 'rgba(34,197,94,0.12)' : 'var(--color-bg-hover)',
            color: captainId ? 'var(--color-success)' : 'var(--color-warning)',
            border: `1px solid ${captainId ? 'var(--color-success)' : 'var(--color-warning)'}`,
          }}
        >
          <span>★</span>
          {captainId ? (
            <>Capitan: <strong>{(() => { const p = list.find(x => x.id === captainId); return p ? `${p.firstName} ${p.lastName}` : '—'; })()}</strong></>
          ) : (
            <>Falta asignar capitan (toca la estrella)</>
          )}
        </div>
        {teamSuspendedIncluded.length > 0 && (
          <p className="text-[11px] mb-2 px-2 py-1 rounded" style={{ backgroundColor: 'rgba(234, 88, 12, 0.15)', color: 'var(--color-danger)' }}>
            Atencion: hay jugadores suspendidos incluidos manualmente.
          </p>
        )}
        <div className="space-y-1 max-h-[45vh] overflow-y-auto pr-1">
          {list.length === 0 && (
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Sin jugadores cargados</p>
          )}
          {active.map(p => {
            const susp = suspended[p.id];
            const isCaptain = captainId === p.id;
            const isLibre = libreIds.has(p.id);
            return (
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
                <button
                  type="button"
                  onClick={() => setCaptain(side, p.id)}
                  className="shrink-0 w-6 h-6 rounded flex items-center justify-center text-base leading-none"
                  style={{
                    color: isCaptain ? '#f59e0b' : 'var(--color-text-muted)',
                    border: `1px solid ${isCaptain ? '#f59e0b' : 'var(--color-border)'}`,
                    backgroundColor: isCaptain ? 'rgba(245,158,11,0.15)' : 'transparent',
                  }}
                  title={isCaptain ? 'Capitan (click para quitar)' : 'Designar capitan'}
                >
                  {isCaptain ? '★' : '☆'}
                </button>
                <button
                  type="button"
                  onClick={() => toggleLibre(p, teamId)}
                  className="shrink-0 w-6 h-6 rounded flex items-center justify-center text-[11px] font-bold leading-none"
                  style={{
                    color: isLibre ? '#ffffff' : 'var(--color-text-muted)',
                    border: `1px solid ${isLibre ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    backgroundColor: isLibre ? 'var(--color-primary)' : 'transparent',
                  }}
                  title={isLibre ? 'Libre (click para quitar marca)' : 'Marcar como libre'}
                >
                  L
                </button>
                <span className="flex-1 text-sm truncate" style={{ color: 'var(--color-text)' }}>
                  {p.firstName} {p.lastName}
                </span>
                {susp && (
                  <span
                    className="shrink-0 text-[10px] px-1.5 py-0.5 rounded font-semibold"
                    style={{ backgroundColor: 'var(--color-danger)', color: '#ffffff' }}
                    title={`Suspendido: ${susp.reason}${susp.fromMatchRound ? ` (Fecha ${susp.fromMatchRound})` : ''}`}
                  >
                    SUSP
                  </span>
                )}
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
            );
          })}
        </div>
        {excluded.length > 0 && (
          <div className="mt-3 pt-2" style={{ borderTop: '1px dashed var(--color-border)' }}>
            <p className="text-[11px] mb-1 font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
              No juegan este partido ({excluded.length})
            </p>
            <div className="space-y-1 max-h-[25vh] overflow-y-auto pr-1">
              {excluded.map(p => {
                const susp = suspended[p.id];
                return (
                  <div key={p.id} className="flex items-center gap-2 opacity-70">
                    <span className="flex-1 text-sm truncate line-through" style={{ color: 'var(--color-text-secondary)' }}>
                      #{p.number} {p.firstName} {p.lastName}
                    </span>
                    {susp && (
                      <span
                        className="shrink-0 text-[10px] px-1.5 py-0.5 rounded font-semibold"
                        style={{ backgroundColor: 'var(--color-danger)', color: '#ffffff' }}
                        title={`Suspendido por ${susp.reason}${susp.fromMatchRound ? ` en Fecha ${susp.fromMatchRound}` : ''}`}
                      >
                        SUSP
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleRemove(p.id)}
                      className="shrink-0 text-xs px-2 py-0.5 rounded font-medium"
                      style={{ color: 'var(--color-primary)', border: '1px solid var(--color-primary)' }}
                      title={susp ? `Forzar inclusion (suspendido: ${susp.reason})` : 'Volver a incluir'}
                    >
                      + Incluir
                    </button>
                  </div>
                );
              })}
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
          Numeros de jugadores y capitanes
        </h3>
        <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
          Modifica el numero que usa cada jugador, asigna un capitan por equipo (★) y excluye con ✕ a los que no juegan.
        </p>
        {loadingSuspensions ? (
          <p className="text-[11px] mb-3" style={{ color: 'var(--color-text-muted)' }}>
            Revisando suspensiones de partidos previos...
          </p>
        ) : Object.keys(suspended).length > 0 && (
          <p className="text-[11px] mb-3 px-2 py-1 rounded" style={{ backgroundColor: 'var(--color-bg-hover)', color: 'var(--color-text-secondary)' }}>
            Se detectaron {Object.keys(suspended).length} jugador{Object.keys(suspended).length === 1 ? '' : 'es'} suspendido{Object.keys(suspended).length === 1 ? '' : 's'} por expulsiones previas. Quedan excluidos por defecto (podes forzarlos con "+ Incluir").
          </p>
        )}
        <div className="flex flex-col md:flex-row gap-4">
          {renderTeam('home', home, homePlayers)}
          <div className="hidden md:block w-px" style={{ backgroundColor: 'var(--color-border)' }} />
          {renderTeam('away', away, awayPlayers)}
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
