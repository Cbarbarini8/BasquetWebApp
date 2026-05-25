// Playoffs Apertura 2026 (Liga Comercial de Basquet).
//
// Estructura del bracket (10 equipos):
//   Play-in:  7° vs 10°, 8° vs 9° → 2 ganadores reordenados como nuevo 7° y 8°
//   Cuartos:  4° vs 5°, 3° vs 6°, 1° vs 8°(reord), 2° vs 7°(reord)
//   Semis:    bracket estatico — G(1v8) vs G(4v5) (sf-1), G(2v7) vs G(3v6) (sf-2)
//   Final:    G(sf-1) vs G(sf-2)
// El UNICO reordenamiento por tabla general es el del play-in (reseed 7/8). De
// cuartos en adelante el cruce es FIJO (bracket clasico), como pide el reglamento.
//
// Modelo de datos:
//   - Cada partido del playoff es un doc normal en `matches` con campos extra:
//       bracketSlot: 'pi-1' | 'pi-2' | 'qf-1'..'qf-4' | 'sf-1' | 'sf-2' | 'final'
//       homeSeedRef: SeedRef
//       awaySeedRef: SeedRef
//   - El seasonId guarda playoffSeeds: [teamId1..teamId10] — snapshot ordenado
//     de la tabla general al momento de generar los playoffs. Las seedRefs
//     resuelven contra ese snapshot (y no contra la tabla "viva") para que el
//     bracket sea estable aunque se editen partidos de la fase regular despues.
//   - homeTeamId/awayTeamId arrancan en null en los 5 partidos que dependen
//     de rondas previas; se materializan via propagateBracket cuando el match
//     padre termina (finished o walkover).

import { collection, doc, getDoc, getDocs, query, where, writeBatch, serverTimestamp, Timestamp } from 'firebase/firestore';
import { computeStandings } from './calculations';

// Constantes parametrizables — si en una temporada futura cambian (e.g., 8
// equipos sin play-in), creamos otro template.
export const PLAYOFF_TEAM_COUNT = 10;
export const PLAYOFF_BRACKET_SLOTS = ['pi-1', 'pi-2', 'qf-1', 'qf-2', 'qf-3', 'qf-4', 'sf-1', 'sf-2', 'final'];

// Template del bracket. `round` solo sirve para ordenar en consultas; queda
// alto (>= 100) para no chocar con rondas regulares.
export const PLAYOFF_TEMPLATE = [
  // Play-in
  { slot: 'pi-1', phase: 'play-in', round: 100, column: 0,
    homeSeedRef: { type: 'rank', position: 7 },
    awaySeedRef: { type: 'rank', position: 10 } },
  { slot: 'pi-2', phase: 'play-in', round: 100, column: 0,
    homeSeedRef: { type: 'rank', position: 8 },
    awaySeedRef: { type: 'rank', position: 9 } },
  // Cuartos directos (no dependen de play-in)
  { slot: 'qf-1', phase: 'play-off', round: 101, column: 1,
    homeSeedRef: { type: 'rank', position: 4 },
    awaySeedRef: { type: 'rank', position: 5 } },
  { slot: 'qf-2', phase: 'play-off', round: 101, column: 1,
    homeSeedRef: { type: 'rank', position: 3 },
    awaySeedRef: { type: 'rank', position: 6 } },
  // Cuartos con play-in (reordenados)
  { slot: 'qf-3', phase: 'play-off', round: 102, column: 1,
    homeSeedRef: { type: 'rank', position: 1 },
    awaySeedRef: { type: 'playInWinnerReorder', reorderedPosition: 8 } },
  { slot: 'qf-4', phase: 'play-off', round: 103, column: 1,
    homeSeedRef: { type: 'rank', position: 2 },
    awaySeedRef: { type: 'playInWinnerReorder', reorderedPosition: 7 } },
  // Semis (bracket estatico: G(1v8) vs G(4v5) / G(2v7) vs G(3v6))
  { slot: 'sf-1', phase: 'semifinal', round: 104, column: 2,
    homeSeedRef: { type: 'matchWinner', slot: 'qf-3' },
    awaySeedRef: { type: 'matchWinner', slot: 'qf-1' } },
  { slot: 'sf-2', phase: 'semifinal', round: 104, column: 2,
    homeSeedRef: { type: 'matchWinner', slot: 'qf-4' },
    awaySeedRef: { type: 'matchWinner', slot: 'qf-2' } },
  // Final (G(sf-1) vs G(sf-2); sf-1 es el lado del 1°, va de local nominal)
  { slot: 'final', phase: 'final', round: 105, column: 3,
    homeSeedRef: { type: 'matchWinner', slot: 'sf-1' },
    awaySeedRef: { type: 'matchWinner', slot: 'sf-2' } },
];

// Layout para el bracket UI (4 columnas). Orden vertical pensado para que las
// conexiones qf→sf→final NO se crucen: sf-1 recibe a qf-3 y qf-1 (las dos de
// arriba), sf-2 recibe a qf-4 y qf-2 (las dos de abajo).
//
//   pi-1 (7°v10°) ─┐                qf-3 (1°v8°) ─┐
//                  ╲                              ├→ sf-1
//                   ╳ reseed 7/8    qf-1 (4°v5°) ─┘
//                  ╱
//   pi-2 (8°v9°)  ─┘                qf-2 (3°v6°) ─┐
//                                                 ├→ sf-2
//                                  qf-4 (2°v7°) ─┘
//
// De cuartos en adelante el cruce es FIJO (matchWinner), asi que esas lineas
// son precisas. Solo las lineas pi→qf son indicativas: el reseed 7/8 decide
// que play-in alimenta qf-3 (el 8°) vs qf-4 (el 7°). Esos dos slots llevan "Reord.".
export const BRACKET_COLUMNS = [
  { id: 'play-in', title: 'Play-in', slots: ['pi-1', 'pi-2'] },
  { id: 'cuartos', title: 'Cuartos', slots: ['qf-3', 'qf-1', 'qf-2', 'qf-4'] },
  { id: 'semis', title: 'Semis', slots: ['sf-1', 'sf-2'] },
  { id: 'final', title: 'Final', slots: ['final'] },
];

// Helpers de "ganador de un match" — null si todavia no esta definido.
export function getWinnerOf(match) {
  if (!match) return null;
  if (match.status === 'walkover') {
    return match.walkoverNoShow === 'home' ? match.awayTeamId : match.homeTeamId;
  }
  if (match.status !== 'finished') return null;
  const hs = match.homeScore || 0;
  const as = match.awayScore || 0;
  if (hs > as) return match.homeTeamId;
  if (as > hs) return match.awayTeamId;
  return null; // empate teorico (no deberia pasar en playoff)
}

// Reordena teamIds segun el ranking guardado en playoffSeeds. Si algun id no
// esta en seeds (datos corruptos), lo manda al final por orden estable.
function reorderBySeeds(teamIds, seeds) {
  return [...teamIds]
    .filter(Boolean)
    .map(t => {
      const idx = seeds.indexOf(t);
      return { teamId: t, rank: idx < 0 ? 9999 : idx };
    })
    .sort((a, b) => a.rank - b.rank || String(a.teamId).localeCompare(String(b.teamId)))
    .map(x => x.teamId);
}

// Resuelve una seedRef contra el snapshot (seeds) + matches del playoff.
// Devuelve teamId o null si todavia no se puede resolver.
export function resolveSeedToTeamId(seedRef, ctx) {
  if (!seedRef || !ctx) return null;
  const { seeds = [], playoffMatches = [] } = ctx;
  if (!seeds.length) return null;

  switch (seedRef.type) {
    case 'rank':
      return seeds[seedRef.position - 1] ?? null;

    case 'playInWinnerReorder': {
      const playIns = playoffMatches.filter(m => m.bracketSlot && m.bracketSlot.startsWith('pi-'));
      if (playIns.length !== 2) return null;
      const winners = playIns.map(getWinnerOf);
      if (winners.some(w => w == null)) return null;
      const reordered = reorderBySeeds(winners, seeds);
      if (reordered.length !== 2) return null;
      // 7 = mejor seed (index 0), 8 = peor seed (index 1)
      if (seedRef.reorderedPosition === 7) return reordered[0];
      if (seedRef.reorderedPosition === 8) return reordered[1];
      return null;
    }

    case 'matchWinner': {
      const m = playoffMatches.find(x => x.bracketSlot === seedRef.slot);
      return getWinnerOf(m);
    }

    default:
      return null;
  }
}

// Etiquetas legibles para placeholders "Ganador de <slot>" en el bracket UI.
const MATCH_WINNER_LABEL = {
  'qf-1': 'Ganador 4° vs 5°',
  'qf-2': 'Ganador 3° vs 6°',
  'qf-3': 'Ganador 1° vs 8°',
  'qf-4': 'Ganador 2° vs 7°',
  'sf-1': 'Ganador Semi 1',
  'sf-2': 'Ganador Semi 2',
};

// Etiqueta human-readable para una seedRef cuando todavia no se resolvio.
export function seedLabel(seedRef) {
  if (!seedRef) return 'Por definir';
  switch (seedRef.type) {
    case 'rank':
      return `${seedRef.position}° tabla general`;
    case 'playInWinnerReorder':
      return seedRef.reorderedPosition === 7
        ? 'Ganador play-in (mejor seed)'
        : 'Ganador play-in (peor seed)';
    case 'matchWinner':
      return MATCH_WINNER_LABEL[seedRef.slot] || `Ganador ${seedRef.slot}`;
    default:
      return 'Por definir';
  }
}

// Etiqueta legible del slot (para el bracket UI). Solo la fase — el cruce
// concreto (e.g. "1° vs 8°") queda implicito en los seeds que se muestran
// al lado de cada equipo en el bracket.
export function slotLabel(slot) {
  const labels = {
    'pi-1': 'Play-in',
    'pi-2': 'Play-in',
    'qf-1': 'Cuartos',
    'qf-2': 'Cuartos',
    'qf-3': 'Cuartos',
    'qf-4': 'Cuartos',
    'sf-1': 'Semi 1',
    'sf-2': 'Semi 2',
    'final': 'Final',
  };
  return labels[slot] || slot;
}

// Valida si standings tiene al menos PLAYOFF_TEAM_COUNT equipos rankeados
// (necesario para poder armar el bracket de 10).
export function canGeneratePlayoffs(standings, regularMatches) {
  if (!Array.isArray(standings) || standings.length < PLAYOFF_TEAM_COUNT) {
    return { ok: false, reason: `Se necesitan al menos ${PLAYOFF_TEAM_COUNT} equipos en la tabla general (hay ${standings?.length || 0}).` };
  }
  const regular = (regularMatches || []).filter(m => !m.phase || m.phase === 'regular');
  const pending = regular.filter(m => m.status !== 'finished' && m.status !== 'walkover');
  if (pending.length > 0) {
    return { ok: false, reason: `Quedan ${pending.length} partidos de fase regular sin finalizar.` };
  }
  if (regular.length === 0) {
    return { ok: false, reason: 'No hay partidos de fase regular cargados.' };
  }
  return { ok: true };
}

// Calcula seeds (top N teamIds) a partir de matches + teams.
export function computePlayoffSeeds(matches, teams) {
  const regular = (matches || []).filter(m => !m.phase || m.phase === 'regular');
  const standings = computeStandings(regular, teams);
  return standings.slice(0, PLAYOFF_TEAM_COUNT).map(s => s.teamId);
}

// Devuelve la lista de partidos del playoff (template materializado a docs
// listos para escribir). teamIds: array de 10 (las seeds 1°..10°).
export function buildPlayoffMatches({ seasonId, seeds, courtId = null }) {
  if (!seasonId) throw new Error('seasonId requerido');
  if (!Array.isArray(seeds) || seeds.length < PLAYOFF_TEAM_COUNT) {
    throw new Error(`seeds debe tener al menos ${PLAYOFF_TEAM_COUNT} teamIds`);
  }
  return PLAYOFF_TEMPLATE.map(tpl => {
    // Para los partidos sin dependencias (rank puro), materializamos teamId
    // en la generacion. El resto queda en null y se llena via propagateBracket.
    const homeTeamId = tpl.homeSeedRef.type === 'rank' ? (seeds[tpl.homeSeedRef.position - 1] ?? null) : null;
    const awayTeamId = tpl.awaySeedRef.type === 'rank' ? (seeds[tpl.awaySeedRef.position - 1] ?? null) : null;
    return {
      bracketSlot: tpl.slot,
      phase: tpl.phase,
      round: tpl.round,
      homeSeedRef: tpl.homeSeedRef,
      awaySeedRef: tpl.awaySeedRef,
      homeTeamId,
      awayTeamId,
      homeScore: 0,
      awayScore: 0,
      status: 'scheduled',
      seasonId,
      courtId,
      scheduledDate: null,
      scheduledTime: '',
      quarter: 0,
      timeouts: { home: {}, away: {} },
      createdAt: serverTimestamp(),
      startedAt: null,
      finishedAt: null,
    };
  });
}

// Escribe playoffSeeds en el doc de season y los 9 matches del bracket.
// Falla si ya hay matches con bracketSlot para esa temporada (evita duplicar).
export async function generatePlayoffsForSeason(db, { seasonId, seeds, courtId = null, existingMatches = [] }) {
  const dup = (existingMatches || []).filter(m => m.bracketSlot && m.seasonId === seasonId);
  if (dup.length > 0) {
    throw new Error('Ya existen partidos de playoff para esta temporada. Eliminalos antes de regenerar.');
  }
  const docs = buildPlayoffMatches({ seasonId, seeds, courtId });
  const batch = writeBatch(db);
  // Snapshot de seeds en el doc de season para que la resolucion sea estable.
  batch.update(doc(db, 'seasons', seasonId), {
    playoffSeeds: seeds,
    playoffGeneratedAt: serverTimestamp(),
  });
  const createdIds = [];
  docs.forEach(d => {
    const ref = doc(collection(db, 'matches'));
    batch.set(ref, d);
    createdIds.push({ id: ref.id, slot: d.bracketSlot });
  });
  await batch.commit();
  return createdIds;
}

// Hook de propagacion: corre despues de que un match termina. Para cada match
// del playoff sin teamId resuelto, intenta resolver via seedRef + estado
// actual de los matches del playoff + seeds snapshot. Escribe lo que pueda.
//
// Idempotente: ya hizo nada si no hay cambios. Pasala dentro del flujo de
// finishMatch / markWalkover despues del commit principal.
export async function propagateBracket(db, seasonId, allMatches) {
  if (!seasonId) return [];
  const seasonSnap = await getDoc(doc(db, 'seasons', seasonId));
  if (!seasonSnap.exists()) return [];
  const season = seasonSnap.data();
  const seeds = season.playoffSeeds;
  if (!Array.isArray(seeds) || seeds.length === 0) return [];

  let playoffMatches = (allMatches || []).filter(m => m.bracketSlot && m.seasonId === seasonId);
  if (playoffMatches.length === 0) {
    // Fallback: si no nos pasaron allMatches actualizado, los leemos.
    const q = query(collection(db, 'matches'), where('seasonId', '==', seasonId));
    const snap = await getDocs(q);
    playoffMatches = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(m => m.bracketSlot);
  }
  if (playoffMatches.length === 0) return [];

  const updates = [];
  playoffMatches.forEach(m => {
    const update = {};
    if (!m.homeTeamId && m.homeSeedRef) {
      const t = resolveSeedToTeamId(m.homeSeedRef, { seeds, playoffMatches });
      if (t) update.homeTeamId = t;
    }
    if (!m.awayTeamId && m.awaySeedRef) {
      const t = resolveSeedToTeamId(m.awaySeedRef, { seeds, playoffMatches });
      if (t) update.awayTeamId = t;
    }
    if (Object.keys(update).length > 0) {
      updates.push({ id: m.id, ...update });
    }
  });

  if (updates.length === 0) return [];
  const batch = writeBatch(db);
  updates.forEach(({ id, ...data }) => {
    batch.update(doc(db, 'matches', id), data);
  });
  await batch.commit();
  return updates;
}

// Util para el bracket UI: dado un match + seeds, devuelve { homeTeamId,
// awayTeamId, homeLabel, awayLabel } donde label es el placeholder cuando el
// equipo no esta resuelto.
export function resolveMatchForBracket(match, ctx) {
  const home = match.homeTeamId || resolveSeedToTeamId(match.homeSeedRef, ctx);
  const away = match.awayTeamId || resolveSeedToTeamId(match.awaySeedRef, ctx);
  return {
    homeTeamId: home,
    awayTeamId: away,
    homeLabel: home ? null : seedLabel(match.homeSeedRef),
    awayLabel: away ? null : seedLabel(match.awaySeedRef),
  };
}

// Helper para el seed script de tests: convierte Timestamps si hace falta.
export { Timestamp };
