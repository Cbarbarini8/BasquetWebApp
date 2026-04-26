// Regla: un jugador queda suspendido si tiene una expulsion directa (`ejection`)
// con `suspensionMatches: N` y aun no se cumplieron las N fechas de partidos
// finalizados posteriores. Las 5 faltas y las 2 flagrantes solo expulsan del
// partido actual, no suspenden fechas siguientes.
//
// Eventos ejection sin `suspensionMatches` (datos historicos) se asumen N=1.

const DEFAULT_SUSPENSION_MATCHES = 1;
const MAX_LOOKBACK = 10; // techo razonable para sanciones largas

const toMillis = (d) => {
  if (!d) return 0;
  if (typeof d.toMillis === 'function') return d.toMillis();
  if (d instanceof Date) return d.getTime();
  if (typeof d === 'number') return d;
  return 0;
};

const matchSortKey = (m) => toMillis(m.scheduledDate) || toMillis(m.createdAt);

// Devuelve hasta `limit` partidos finalizados anteriores del equipo en la misma
// temporada, ordenados descendente (mas reciente primero).
export function findRecentFinishedMatches(allMatches, currentMatch, teamId, limit = MAX_LOOKBACK) {
  const candidates = allMatches.filter(m =>
    m.id !== currentMatch.id &&
    m.status === 'finished' &&
    m.seasonId === currentMatch.seasonId &&
    (m.homeTeamId === teamId || m.awayTeamId === teamId)
  );
  candidates.sort((a, b) => matchSortKey(b) - matchSortKey(a));
  return candidates.slice(0, limit);
}

// Mantengo el helper viejo por si lo usa algun otro consumidor.
export function findPreviousFinishedMatch(allMatches, currentMatch, teamId) {
  return findRecentFinishedMatches(allMatches, currentMatch, teamId, 1)[0] || null;
}

// Dado el partido actual, los partidos finalizados previos del equipo y un mapa
// { matchId -> events[] }, calcula que jugadores del equipo siguen suspendidos
// para `currentMatch`. Devuelve { [playerId]: { reason, fromMatchId,
// fromMatchRound, remaining } }, donde `remaining` es la cantidad de fechas
// que aun debe cumplir contando este partido como una de ellas si lo cumple.
export function computeActiveSuspensionsForTeam(currentMatch, recentFinishedMatches, eventsByMatchId, teamId) {
  const result = {};
  // Ordenar ascendente para que "partidos jugados despues" sea calculo simple.
  const asc = [...recentFinishedMatches].sort((a, b) => matchSortKey(a) - matchSortKey(b));

  asc.forEach((sourceMatch, idx) => {
    const events = eventsByMatchId[sourceMatch.id] || [];
    events.forEach(e => {
      if (e.type !== 'ejection') return;
      if (e.teamId !== teamId) return;
      if (!e.playerId) return;
      const total = Number.isFinite(e.suspensionMatches) && e.suspensionMatches > 0
        ? Math.floor(e.suspensionMatches)
        : DEFAULT_SUSPENSION_MATCHES;
      const playedAfter = asc.length - 1 - idx;
      const remaining = total - playedAfter;
      if (remaining <= 0) return;
      const prev = result[e.playerId];
      // Si tiene varias expulsiones activas, conservar la mas reciente (mayor remaining gana en empate).
      if (!prev || remaining > prev.remaining) {
        result[e.playerId] = {
          reason: total > 1 ? `expulsion directa (${total} fechas)` : 'expulsion directa',
          fromMatchId: sourceMatch.id,
          fromMatchRound: sourceMatch.round,
          remaining,
        };
      }
    });
  });

  return result;
}

// API legacy mantenida para no romper consumidores externos que aun la usen.
// Solo computa ejections del partido pasado (no soporta multiples fechas).
export function computeSuspensionsFromEvents(events) {
  const result = {};
  events.forEach(e => {
    if (e.type === 'ejection' && e.playerId) {
      result[e.playerId] = 'expulsion directa';
    }
  });
  return result;
}
