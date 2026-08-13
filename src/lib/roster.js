// Reglamento Liga Comercial 2026: plantel y jugadores libres.
// - Maximo 15 jugadores por plantel / lista de buena fe (MAX_SQUAD_SIZE).
// - Maximo 12 convocados por partido (titulares + suplentes).
// - Maximo 3 jugadores libres por partido por equipo.
// - Los libres no pueden ser de la categoria joven (19-24).
// - Un libre que jugo para un equipo no puede jugar como libre para otro
//   equipo en el torneo.
// - En semifinal/final no se pueden incorporar libres NUEVOS — solo los que
//   ya jugaron antes para ese equipo (cruce con historial derivado de
//   matches.libres).
//
// Modelo de datos: `match.libres.{home|away}` es array de playerIds que
// jugaron como libres en ese partido. El historial de un jugador es derivable
// scanneando todos los matches (no se denormaliza en el doc del jugador para
// evitar inconsistencias).

import { categoryFor, CATEGORY_YOUNG, CATEGORY_LABEL } from './playerCategory';

// Plantel completo del equipo (lista de buena fe), no confundir con el cupo
// de convocados por partido.
export const MAX_SQUAD_SIZE = 15;
export const MAX_ROSTER_SIZE = 12;
export const MAX_LIBRES_PER_MATCH = 3;

const NO_NEW_LIBRES_PHASES = new Set(['semifinal', 'final']);

// Deriva el historial de jugadas-como-libre de TODOS los jugadores a partir
// del array de matches. Devuelve { [playerId]: [{ teamId, matchId }] }.
export function deriveLibreHistory(matches) {
  const history = {};
  matches.forEach(m => {
    const home = Array.isArray(m.libres?.home) ? m.libres.home : [];
    const away = Array.isArray(m.libres?.away) ? m.libres.away : [];
    home.forEach(pid => {
      if (!history[pid]) history[pid] = [];
      history[pid].push({ teamId: m.homeTeamId, matchId: m.id });
    });
    away.forEach(pid => {
      if (!history[pid]) history[pid] = [];
      history[pid].push({ teamId: m.awayTeamId, matchId: m.id });
    });
  });
  return history;
}

// Verifica si un jugador puede ser libre para `teamId` en `phase`.
// `playerHistory` es el array de entradas previas del jugador (de
// deriveLibreHistory). `excludeMatchId` permite ignorar el partido actual al
// chequear (para que re-elegir libres en un mismo match no se autoinvalide).
// `seasonYear` es el anio del torneo, para resolver la categoria por anio de
// nacimiento (ver playerCategory.js).
export function checkLibreEligibility(player, teamId, phase, playerHistory = [], excludeMatchId = null, seasonYear = undefined) {
  if (!player) return { ok: false, reason: 'jugador no encontrado' };
  if (categoryFor(player.birthDate, seasonYear) === CATEGORY_YOUNG) {
    return { ok: false, reason: `no puede ser libre (categoria ${CATEGORY_LABEL[CATEGORY_YOUNG]})` };
  }
  const otherTeams = playerHistory
    .filter(e => e.matchId !== excludeMatchId)
    .filter(e => e.teamId && e.teamId !== teamId);
  if (otherTeams.length > 0) {
    return { ok: false, reason: 'ya jugo como libre para otro equipo' };
  }
  if (NO_NEW_LIBRES_PHASES.has(phase)) {
    const hadInThisTeam = playerHistory
      .filter(e => e.matchId !== excludeMatchId)
      .some(e => e.teamId === teamId);
    if (!hadInThisTeam) {
      return { ok: false, reason: `en ${phase} no se admiten libres nuevos` };
    }
  }
  return { ok: true };
}
