import { collection, doc, serverTimestamp } from 'firebase/firestore';
import { pausedRemainingFromMatch } from '../hooks/useMatchClock';

// Modelo de tiempo en cancha:
// - match.currentStint = { startClockMs, quarter, startedAt, players: [{playerId, teamId}] } | null
// - subcoleccion matches/{id}/playerStints con docs ya cerrados:
//   { playerId, teamId, quarter, startClockMs, endClockMs, durationMs, createdAt }
// Un stint abierto en el match doc representa "reloj corriendo con esta lista".
// Cualquier evento que cambie la lista en cancha, pause el reloj, cambie de
// cuarto, edite el reloj o finalice el partido debe cerrarlo.

// Agrega al batch los writes para cerrar el stint abierto, si existe y tiene
// duracion > 0. Devuelve true si genero escritos.
export function closeOpenStintToBatch(batch, db, match) {
  const open = match?.currentStint;
  if (!open || !Array.isArray(open.players) || open.players.length === 0) return false;
  const nowMs = pausedRemainingFromMatch(match);
  const duration = Math.max(0, (open.startClockMs ?? 0) - nowMs);
  if (duration <= 0) return false;
  open.players.forEach(p => {
    if (!p?.playerId) return;
    const ref = doc(collection(db, `matches/${match.id}/playerStints`));
    batch.set(ref, {
      playerId: p.playerId,
      teamId: p.teamId || null,
      quarter: open.quarter || 1,
      startClockMs: open.startClockMs,
      endClockMs: nowMs,
      durationMs: duration,
      createdAt: serverTimestamp(),
    });
  });
  return true;
}

// Devuelve el objeto `currentStint` para guardar en el match doc. Si no hay
// jugadores, devuelve null (no hay stint abierto).
export function buildOpenStint(clockMs, quarter, players) {
  if (!players || players.length === 0) return null;
  return {
    startClockMs: clockMs,
    quarter,
    startedAt: Date.now(),
    players: players.map(p => ({ playerId: p.playerId, teamId: p.teamId || null })),
  };
}

export function aggregateStintsByPlayer(stints) {
  const totals = {};
  (stints || []).forEach(s => {
    if (!s?.playerId || typeof s.durationMs !== 'number') return;
    totals[s.playerId] = (totals[s.playerId] || 0) + s.durationMs;
  });
  return totals;
}

export function formatMinutes(ms) {
  const totalSec = Math.max(0, Math.round((ms || 0) / 1000));
  const mm = Math.floor(totalSec / 60);
  const ss = (totalSec % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}
