// Regla: un jugador queda suspendido para el proximo partido si en el
// partido previo acumulo 2 faltas flagrantes (tecnicas/antideportivas)
// combinadas, o si registro una expulsion directa.
// Las 5 faltas personales no suspenden (solo expulsan del partido).

const FLAGRANT_TYPES = ['foulTech', 'foulUnsport'];
const FLAGRANT_LIMIT_FOR_SUSPENSION = 2;

export function computeSuspensionsFromEvents(events) {
  const flagrantCount = {};
  const ejected = new Set();
  events.forEach(e => {
    if (FLAGRANT_TYPES.includes(e.type)) {
      flagrantCount[e.playerId] = (flagrantCount[e.playerId] || 0) + 1;
    }
    if (e.type === 'ejection') {
      ejected.add(e.playerId);
    }
  });
  const result = {};
  ejected.forEach(playerId => {
    result[playerId] = 'expulsion directa';
  });
  Object.entries(flagrantCount).forEach(([playerId, count]) => {
    if (count >= FLAGRANT_LIMIT_FOR_SUSPENSION && !result[playerId]) {
      result[playerId] = '2 faltas tecnicas/antideportivas';
    }
  });
  return result;
}

const toMillis = (d) => {
  if (!d) return 0;
  if (typeof d.toMillis === 'function') return d.toMillis();
  if (d instanceof Date) return d.getTime();
  if (typeof d === 'number') return d;
  return 0;
};

// Devuelve el partido finalizado mas reciente del equipo en la misma temporada,
// excluyendo el partido actual. "Mas reciente" = mayor scheduledDate; si hay
// empate o falta scheduledDate, desempata por createdAt.
export function findPreviousFinishedMatch(allMatches, currentMatch, teamId) {
  const candidates = allMatches.filter(m =>
    m.id !== currentMatch.id &&
    m.status === 'finished' &&
    m.seasonId === currentMatch.seasonId &&
    (m.homeTeamId === teamId || m.awayTeamId === teamId)
  );
  candidates.sort((a, b) => {
    const diff = toMillis(b.scheduledDate) - toMillis(a.scheduledDate);
    if (diff !== 0) return diff;
    return toMillis(b.createdAt) - toMillis(a.createdAt);
  });
  return candidates[0] || null;
}
