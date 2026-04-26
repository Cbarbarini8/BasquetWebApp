import { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { collection, doc, updateDoc, writeBatch, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { logStatsParticipation } from '../../lib/audit';
import { useToast } from '../../context/ToastContext';
import { useMatchClock, defaultQuarterMs, pausedRemainingFromMatch, formatClock } from '../../hooks/useMatchClock';
import { closeOpenStintToBatch, buildOpenStint } from '../../lib/stints';
import CompactScoringUI from './CompactScoringUI';

// Orden 4x4 por categoria con paleta familia:
// Fila 1: anotacion encestada + asistencia (vibrantes positivos)
// Fila 2: errados + perdida (escala de grises)
// Fila 3: defensa / recuperacion (teal/cian)
// Fila 4: faltas (alarma escalada: naranja -> rojo -> negro)
const EVENT_BUTTONS = [
  { type: '2pt', label: '+2', made: true, points: 2, color: 'var(--color-success)' },
  { type: '3pt', label: '+3', made: true, points: 3, color: 'var(--color-primary)' },
  { type: 'ft', label: 'TL', made: true, points: 1, color: 'var(--color-accent)' },
  { type: 'assist', label: 'Asist', color: '#8b5cf6' },
  { type: '2pt', label: '2 Err', made: false, points: 0, color: '#9ca3af' },
  { type: '3pt', label: '3 Err', made: false, points: 0, color: '#6b7280' },
  { type: 'ft', label: 'TL Err', made: false, points: 0, color: '#4b5563' },
  { type: 'turnover', label: 'Perdida', color: '#374151' },
  { type: 'defRebound', label: 'Reb Def', color: '#0d9488' },
  { type: 'offRebound', label: 'Reb Of', color: '#0891b2' },
  { type: 'steal', label: 'Robo', color: '#0284c7' },
  { type: 'block', label: 'Tapon', color: '#0369a1' },
  { type: 'foul', label: 'Falta', color: '#f97316' },
  { type: 'foulTech', label: 'F. Tec', color: '#ea580c' },
  { type: 'foulUnsport', label: 'F. Anti', color: '#b91c1c' },
  { type: 'ejection', label: 'Expul', color: '#18181b' },
];

const EVENT_LABELS = {
  '2pt': { true: '+2 pts', false: '2pts err' },
  '3pt': { true: '+3 pts', false: '3pts err' },
  'ft': { true: 'TL conv', false: 'TL err' },
  'foul': 'Falta',
  'foulTech': 'Falta tecnica',
  'foulUnsport': 'Falta antideportiva',
  'foulTechBench': 'Tec. al banco',
  'ejection': 'Expulsion',
  'assist': 'Asistencia',
  'offRebound': 'Reb. ofensivo',
  'defRebound': 'Reb. defensivo',
  'steal': 'Robo',
  'block': 'Tapon',
  'turnover': 'Perdida',
};

// Faltas que suman al jugador (bonus 5).
const PERSONAL_FOUL_TYPES = ['foul', 'foulTech', 'foulUnsport'];
// Faltas que suman al equipo en el cuarto (incluye tecnicas al banco).
const TEAM_FOUL_TYPES = ['foul', 'foulTech', 'foulUnsport', 'foulTechBench'];
const FLAGRANT_FOUL_TYPES = ['foulTech', 'foulUnsport'];
const PERSONAL_FOUL_LIMIT = 5;
const FLAGRANT_FOUL_LIMIT = 2;
const BENCH_TECH_LIMIT = 2;

const MAX_ON_COURT = 5;

function PlayerJersey({ player, selected, onClick, compact = false, fouls = 0, isCaptain = false }) {
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
      {isCaptain && (
        <span
          className={`absolute font-bold leading-none ${compact ? 'top-0 left-0 text-[10px]' : 'top-0.5 left-0.5 text-xs'}`}
          style={{ color: '#f59e0b' }}
          title="Capitan"
        >
          ★
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

function EjectionPromptModal({ playerLabel, defaultMatches = 1, onCancel, onConfirm }) {
  const [value, setValue] = useState(String(defaultMatches));
  const submit = () => {
    const n = parseInt(value, 10);
    if (!Number.isFinite(n) || n < 1) return;
    onConfirm(n);
  };
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={onCancel}
    >
      <div
        className="rounded-lg p-4 w-full max-w-sm"
        style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-base font-bold mb-2" style={{ color: 'var(--color-text)' }}>
          Expulsion directa
        </h3>
        <p className="text-xs mb-3" style={{ color: 'var(--color-text-secondary)' }}>
          {playerLabel}. Indica cuantas fechas de suspension recibe (minimo 1).
        </p>
        <input
          type="number"
          min="1"
          step="1"
          value={value}
          autoFocus
          onChange={e => setValue(e.target.value.replace(/[^0-9]/g, ''))}
          onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          className="w-full px-3 py-2 rounded text-sm font-bold text-center"
          style={{
            backgroundColor: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text)',
          }}
        />
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded text-sm"
            style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            className="px-4 py-1.5 rounded text-sm text-white font-medium"
            style={{ backgroundColor: 'var(--color-danger)' }}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LiveScoring({ match, events, homePlayers, awayPlayers, homeTeam, awayTeam, canEdit = true, user, compact = false }) {
  const { toast } = useToast();
  const [selectedPlayer, setSelectedPlayer] = useState({ home: '', away: '' });
  const [editingCourt, setEditingCourt] = useState({ home: false, away: false });
  const [editingClock, setEditingClock] = useState(false);
  const [clockInput, setClockInput] = useState('');
  // { side, playerId } cuando hay una expulsion pendiente de confirmar fechas
  const [pendingEjection, setPendingEjection] = useState(null);
  const { mmss, remainingMs, running } = useMatchClock(match);
  const autoStoppedRef = useRef(false);

  useEffect(() => {
    if (!canEdit) return;
    if (running && remainingMs <= 0 && !autoStoppedRef.current) {
      autoStoppedRef.current = true;
      const batch = writeBatch(db);
      closeOpenStintToBatch(batch, db, match);
      batch.update(doc(db, 'matches', match.id), {
        clockRunning: false,
        clockRemainingMs: 0,
        clockStartedAt: null,
        currentStint: null,
      });
      batch.commit().then(() => {
        toast.warning(`Fin del cuarto Q${match.quarter || 1}`);
      });
    }
    if (!running || remainingMs > 0) autoStoppedRef.current = false;
  }, [running, remainingMs, canEdit, match, toast]);

  const allPlayers = [...homePlayers, ...awayPlayers];
  const getPlayerLabel = (id) => {
    const p = allPlayers.find(x => x.id === id);
    return p ? `#${p.number} ${p.lastName}` : id;
  };

  const onCourtHomeIds = match.onCourtHome || [];
  const onCourtAwayIds = match.onCourtAway || [];
  const currentQuarter = match.quarter || 1;
  const homeCaptainId = match.homeCaptainId || null;
  const awayCaptainId = match.awayCaptainId || null;

  const { playerPersonalFouls, playerFlagrantFouls, ejectedPlayers, benchTechByTeam } = useMemo(() => {
    const personal = {};
    const flagrant = {};
    const ejected = new Set();
    const benchTech = {};
    events.forEach(e => {
      if (PERSONAL_FOUL_TYPES.includes(e.type) && e.playerId) {
        personal[e.playerId] = (personal[e.playerId] || 0) + 1;
      }
      if (FLAGRANT_FOUL_TYPES.includes(e.type) && e.playerId) {
        flagrant[e.playerId] = (flagrant[e.playerId] || 0) + 1;
      }
      if (e.type === 'ejection' && e.playerId) {
        ejected.add(e.playerId);
      }
      if (e.type === 'foulTechBench' && e.teamId) {
        benchTech[e.teamId] = (benchTech[e.teamId] || 0) + 1;
      }
    });
    return { playerPersonalFouls: personal, playerFlagrantFouls: flagrant, ejectedPlayers: ejected, benchTechByTeam: benchTech };
  }, [events]);

  const ejectionReason = (playerId) => {
    if (ejectedPlayers.has(playerId)) return 'expulsion directa';
    if ((playerFlagrantFouls[playerId] || 0) >= FLAGRANT_FOUL_LIMIT) return '2 faltas tecnicas/antideportivas';
    if ((playerPersonalFouls[playerId] || 0) >= PERSONAL_FOUL_LIMIT) return '5 faltas';
    return null;
  };

  const teamFoulsQ = (teamId) =>
    events.filter(e => TEAM_FOUL_TYPES.includes(e.type) && e.teamId === teamId && (e.quarter || 1) === currentQuarter).length;

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
    const newIds = isOn ? currentIds.filter(id => id !== playerId) : [...currentIds, playerId];
    const batch = writeBatch(db);
    const clockIsRunning = !!match.clockRunning && !!match.currentStint;
    const updates = { [field]: newIds };
    if (clockIsRunning) {
      closeOpenStintToBatch(batch, db, match);
      const newHomeIds = side === 'home' ? newIds : onCourtHomeIds;
      const newAwayIds = side === 'away' ? newIds : onCourtAwayIds;
      const base = pausedRemainingFromMatch(match);
      const players = [
        ...newHomeIds.map(id => ({ playerId: id, teamId: match.homeTeamId })),
        ...newAwayIds.map(id => ({ playerId: id, teamId: match.awayTeamId })),
      ];
      updates.currentStint = buildOpenStint(base, match.quarter || 1, players);
      updates.clockRemainingMs = base;
      updates.clockStartedAt = Date.now();
    }
    batch.update(doc(db, 'matches', match.id), updates);
    await batch.commit();
  };

  // Aplica la baja en cancha + cierre de stint para un jugador expulsado.
  // Muta `matchUpdates` y agrega ops al batch.
  const applyEjectionSideEffects = (batch, matchUpdates, side, playerId) => {
    const courtField = side === 'home' ? 'onCourtHome' : 'onCourtAway';
    const currentIds = side === 'home' ? onCourtHomeIds : onCourtAwayIds;
    if (!currentIds.includes(playerId)) return;
    const newIds = currentIds.filter(id => id !== playerId);
    matchUpdates[courtField] = newIds;
    const clockIsRunning = !!match.clockRunning && !!match.currentStint;
    if (clockIsRunning) {
      closeOpenStintToBatch(batch, db, match);
      const newHomeIds = side === 'home' ? newIds : onCourtHomeIds;
      const newAwayIds = side === 'away' ? newIds : onCourtAwayIds;
      const base = pausedRemainingFromMatch(match);
      const remainingPlayers = [
        ...newHomeIds.map(id => ({ playerId: id, teamId: match.homeTeamId })),
        ...newAwayIds.map(id => ({ playerId: id, teamId: match.awayTeamId })),
      ];
      matchUpdates.currentStint = buildOpenStint(base, match.quarter || 1, remainingPlayers);
      matchUpdates.clockRemainingMs = base;
      matchUpdates.clockStartedAt = Date.now();
    }
  };

  // Confirma una expulsion directa con N fechas (desde el modal).
  const commitEjection = async (side, playerId, suspensionMatches) => {
    const teamId = side === 'home' ? match.homeTeamId : match.awayTeamId;
    const batch = writeBatch(db);
    const eventRef = doc(collection(db, `matches/${match.id}/events`));
    batch.set(eventRef, {
      type: 'ejection',
      playerId,
      teamId,
      quarter: match.quarter || 1,
      suspensionMatches,
      timestamp: serverTimestamp(),
    });
    const matchUpdates = {};
    applyEjectionSideEffects(batch, matchUpdates, side, playerId);
    if (Object.keys(matchUpdates).length > 0) {
      batch.update(doc(db, 'matches', match.id), matchUpdates);
    }
    await batch.commit();
    const label = getPlayerLabel(playerId);
    setSelectedPlayer(prev => ({ ...prev, [side]: '' }));
    setEditingCourt(prev => ({ ...prev, [side]: true }));
    toast.error(`${label}: expulsion directa (${suspensionMatches} fecha${suspensionMatches === 1 ? '' : 's'}). Debe ser reemplazado.`, 6000);
    if (user) await logStatsParticipation(user, match.id, `${homeTeam?.name || 'Local'} vs ${awayTeam?.name || 'Visitante'}`);
  };

  const addEvent = async (side, eventDef, overridePlayerId) => {
    const playerId = overridePlayerId || selectedPlayer[side];
    if (!playerId) {
      toast.info('Selecciona un jugador primero');
      return;
    }

    // Expulsion directa: pedir cuantas fechas antes de escribir.
    if (eventDef.type === 'ejection') {
      setPendingEjection({ side, playerId });
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

    // Si este evento deja al jugador expulsado por acumulacion, sacarlo de
    // cancha y abrir seleccion de reemplazo. La acumulacion (5 personales o
    // 2 flagrantes) saca del partido pero NO suspende fechas: esa logica vive
    // en suspensions.js que solo mira eventos `ejection`.
    const isFoulType = PERSONAL_FOUL_TYPES.includes(eventDef.type);
    const isFlagrantType = FLAGRANT_FOUL_TYPES.includes(eventDef.type);
    const nextPersonal = isFoulType ? (playerPersonalFouls[playerId] || 0) + 1 : (playerPersonalFouls[playerId] || 0);
    const nextFlagrant = isFlagrantType ? (playerFlagrantFouls[playerId] || 0) + 1 : (playerFlagrantFouls[playerId] || 0);
    const willReachFive = isFoulType && nextPersonal >= PERSONAL_FOUL_LIMIT;
    const willReachTwoFlagrant = isFlagrantType && nextFlagrant >= FLAGRANT_FOUL_LIMIT;
    const willBeEjected = willReachFive || willReachTwoFlagrant;

    if (willBeEjected) {
      const matchUpdates = {};
      applyEjectionSideEffects(batch, matchUpdates, side, playerId);
      if (Object.keys(matchUpdates).length > 0) {
        batch.update(doc(db, 'matches', match.id), matchUpdates);
      }
    }

    await batch.commit();

    if (willBeEjected) {
      const label = getPlayerLabel(playerId);
      setSelectedPlayer(prev => ({ ...prev, [side]: '' }));
      setEditingCourt(prev => ({ ...prev, [side]: true }));
      const reason = willReachTwoFlagrant ? '2 faltas tecnicas/antideportivas' : '5 faltas';
      toast.error(`${label} sale del partido (${reason}). Debe ser reemplazado.`, 6000);
    }

    if (user) await logStatsParticipation(user, match.id, `${homeTeam?.name || 'Local'} vs ${awayTeam?.name || 'Visitante'}`);
  };

  // Falta tecnica al banco (sin jugador). A la 2da del partido del mismo
  // equipo, expulsa al capitan automaticamente con 1 fecha de suspension; si
  // el capitan ya esta expulsado, solo avisa.
  const addBenchTechFoul = async (side) => {
    if (!canEdit) return;
    const teamId = side === 'home' ? match.homeTeamId : match.awayTeamId;
    const captainId = side === 'home' ? homeCaptainId : awayCaptainId;
    const previousBenchTechs = benchTechByTeam[teamId] || 0;
    const willTriggerCaptainEjection =
      previousBenchTechs + 1 >= BENCH_TECH_LIMIT &&
      captainId &&
      !ejectionReason(captainId);

    const batch = writeBatch(db);

    const benchEventRef = doc(collection(db, `matches/${match.id}/events`));
    batch.set(benchEventRef, {
      type: 'foulTechBench',
      teamId,
      quarter: match.quarter || 1,
      timestamp: serverTimestamp(),
    });

    const matchUpdates = {};

    if (willTriggerCaptainEjection) {
      const captainEventRef = doc(collection(db, `matches/${match.id}/events`));
      batch.set(captainEventRef, {
        type: 'ejection',
        playerId: captainId,
        teamId,
        quarter: match.quarter || 1,
        suspensionMatches: 1,
        autoFromBenchTech: true,
        timestamp: serverTimestamp(),
      });
      applyEjectionSideEffects(batch, matchUpdates, side, captainId);
    }

    if (Object.keys(matchUpdates).length > 0) {
      batch.update(doc(db, 'matches', match.id), matchUpdates);
    }

    await batch.commit();

    const teamName = side === 'home' ? homeTeam?.name : awayTeam?.name;
    if (willTriggerCaptainEjection) {
      const label = getPlayerLabel(captainId);
      setEditingCourt(prev => ({ ...prev, [side]: true }));
      toast.error(`2da tecnica al banco de ${teamName || 'el equipo'}: capitan ${label} expulsado (1 fecha).`, 6000);
    } else if (previousBenchTechs + 1 >= BENCH_TECH_LIMIT) {
      // Capitan ya esta expulsado o no asignado: no hay a quien sancionar.
      const reason = !captainId ? 'no hay capitan asignado' : 'el capitan ya estaba expulsado';
      toast.warning(`2da tecnica al banco de ${teamName || 'el equipo'}: ${reason}, no se aplica expulsion adicional.`, 6000);
    } else {
      toast.info(`Tecnica al banco de ${teamName || 'el equipo'} (${previousBenchTechs + 1}/${BENCH_TECH_LIMIT}).`);
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
    const batch = writeBatch(db);
    closeOpenStintToBatch(batch, db, match);
    batch.update(doc(db, 'matches', match.id), {
      quarter: q,
      clockRunning: false,
      clockRemainingMs: defaultQuarterMs(q),
      clockStartedAt: null,
      currentStint: null,
    });
    await batch.commit();
    if (user) await logStatsParticipation(user, match.id, `${homeTeam?.name || 'Local'} vs ${awayTeam?.name || 'Visitante'}`);
  };

  const toggleClock = async () => {
    if (!canEdit) return;
    if (running) {
      const remaining = pausedRemainingFromMatch(match);
      const batch = writeBatch(db);
      closeOpenStintToBatch(batch, db, match);
      batch.update(doc(db, 'matches', match.id), {
        clockRunning: false,
        clockRemainingMs: remaining,
        clockStartedAt: null,
        currentStint: null,
      });
      await batch.commit();
    } else {
      const base = typeof match.clockRemainingMs === 'number' ? match.clockRemainingMs : defaultQuarterMs(match.quarter || 1);
      if (base <= 0) {
        toast.info('El reloj esta en 00:00. Modificalo antes de iniciar.');
        return;
      }
      const players = [
        ...onCourtHomeIds.map(id => ({ playerId: id, teamId: match.homeTeamId })),
        ...onCourtAwayIds.map(id => ({ playerId: id, teamId: match.awayTeamId })),
      ];
      await updateDoc(doc(db, 'matches', match.id), {
        clockRunning: true,
        clockRemainingMs: base,
        clockStartedAt: Date.now(),
        currentStint: buildOpenStint(base, match.quarter || 1, players),
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
    const batch = writeBatch(db);
    closeOpenStintToBatch(batch, db, match);
    batch.update(doc(db, 'matches', match.id), {
      clockRunning: false,
      clockRemainingMs: ms,
      clockStartedAt: null,
      currentStint: null,
    });
    await batch.commit();
    setEditingClock(false);
  };

  const getEventLabel = (event) => {
    const label = EVENT_LABELS[event.type];
    if (typeof label === 'string') return label;
    return label?.[event.made] || event.type;
  };

  const benchTechBadge = (teamId) => {
    const n = benchTechByTeam[teamId] || 0;
    if (n === 0) return null;
    return n;
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
    const captainId = side === 'home' ? homeCaptainId : awayCaptainId;
    const benchN = benchTechBadge(side === 'home' ? match.homeTeamId : match.awayTeamId);

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
        <div className={`flex items-center gap-2 flex-wrap ${compact ? 'mb-1 text-[10px]' : 'mb-2 text-xs'}`}>
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
          {canEdit && (
            <button
              type="button"
              onClick={() => addBenchTechFoul(side)}
              className="px-1.5 py-0.5 rounded font-medium"
              style={{
                backgroundColor: benchN >= 1 ? 'var(--color-danger)' : 'transparent',
                color: benchN >= 1 ? '#ffffff' : 'var(--color-text-secondary)',
                border: '1px solid var(--color-border)',
              }}
              title={`Tecnica al banco (${benchN || 0}/${BENCH_TECH_LIMIT}). A la ${BENCH_TECH_LIMIT}da expulsa al capitan.`}
            >
              T.Bco {benchN ? `(${benchN})` : ''}
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
                    isCaptain={captainId === p.id}
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
                        isCaptain={captainId === p.id}
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
                    isCaptain={captainId === p.id}
                  />
                ))}
              </div>
            )}

          </>
        )}

        {/* Botones de eventos (solo modo no compacto; en compacto estan al lado de los jerseys) */}
        {canEdit && !isEditing && !compact && (
          <div className="grid grid-cols-4 gap-1.5 mb-4">
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
            const isBench = lastEvent.type === 'foulTechBench';
            return (
              <div
                className="flex items-center justify-between px-1 py-0.5 rounded text-[10px]"
                style={{ backgroundColor: 'var(--color-bg-hover)' }}
              >
                <span className="truncate" style={{ color: 'var(--color-text-secondary)' }}>
                  {isBench ? 'Banco' : p ? `#${p.number} ${p.lastName}` : '—'} · {getEventLabel(lastEvent)}
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
              const isBench = event.type === 'foulTechBench';
              const player = !isBench ? teamPlayers.find(p => p.id === event.playerId) : null;
              return (
                <div
                  key={event.id}
                  className="flex items-center justify-between px-2 py-1.5 rounded text-xs"
                  style={{ backgroundColor: 'var(--color-bg-hover)' }}
                >
                  <span style={{ color: 'var(--color-text-secondary)' }}>
                    {isBench ? <strong>Banco</strong> : <><strong>#{player?.number}</strong> {player?.lastName}</>} - {getEventLabel(event)}
                    {event.type === 'ejection' && event.suspensionMatches > 0 && (
                      <span className="ml-1 text-[10px] font-bold" style={{ color: 'var(--color-danger)' }}>
                        ({event.suspensionMatches} fecha{event.suspensionMatches === 1 ? '' : 's'})
                      </span>
                    )}
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

  const ejectionModal = pendingEjection && (
    <EjectionPromptModal
      playerLabel={getPlayerLabel(pendingEjection.playerId)}
      onCancel={() => setPendingEjection(null)}
      onConfirm={async (n) => {
        const { side, playerId } = pendingEjection;
        setPendingEjection(null);
        await commitEjection(side, playerId, n);
      }}
    />
  );

  if (compact) {
    return (
      <>
        <CompactScoringUI
          match={match}
          events={events}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          homePlayers={homePlayers}
          awayPlayers={awayPlayers}
          onCourtHomePlayers={onCourtHomePlayers}
          onCourtAwayPlayers={onCourtAwayPlayers}
          onCourtHomeIds={onCourtHomeIds}
          onCourtAwayIds={onCourtAwayIds}
          eventButtons={EVENT_BUTTONS}
          eventLabel={getEventLabel}
          playerPersonalFouls={playerPersonalFouls}
          homeTeamFouls={homeTeamFouls}
          awayTeamFouls={awayTeamFouls}
          benchTechByTeam={benchTechByTeam}
          benchTechLimit={BENCH_TECH_LIMIT}
          homeCaptainId={homeCaptainId}
          awayCaptainId={awayCaptainId}
          ejectionReason={ejectionReason}
          canEdit={canEdit}
          mmss={mmss}
          remainingMs={remainingMs}
          running={running}
          editingClock={editingClock}
          clockInput={clockInput}
          onClockInputChange={setClockInput}
          onOpenClockEdit={openClockEdit}
          onSaveClockEdit={saveClockEdit}
          onCancelClockEdit={() => setEditingClock(false)}
          onToggleClock={toggleClock}
          onUpdateQuarter={updateQuarter}
          onToggleTimeout={toggleTimeout}
          onAddEvent={addEvent}
          onAddBenchTech={addBenchTechFoul}
          onUndoEvent={undoEvent}
          onTogglePlayerOnCourt={togglePlayerOnCourt}
          editingCourt={editingCourt}
          onSetEditingCourt={setEditingCourt}
        />
        {ejectionModal}
      </>
    );
  }

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

      {ejectionModal}
    </div>
  );
}
