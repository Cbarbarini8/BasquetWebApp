// Cupos de tiempos muertos segun reglamento (Liga Comercial 2026):
// - Fase regular / play-in / play-off: 1 TM por cuarto, no acumulable.
// - Semifinal: 1 en Q1/Q2/Q3, 2 en Q4.
// - Final: 1 en Q1, 1 en Q2, pool de 3 entre Q3 y Q4 con maximo 2 en Q4
//   (el reglamento dice "debiendo usar uno en el tercer cuarto", lo dejamos
//   como soft warning visual — no bloqueamos al admin).
// - Prorroga (Q5+): 1 TM, sin importar fase.
//
// Modelo de datos: `match.timeouts.{home|away}.q{N}` es contador entero de
// TMs usados. Tolera valores boolean legacy (true => 1, false/missing => 0).
//
// Cada TM se registra ademas como evento `{ type: 'timeout', teamId, quarter }`
// en `matches/{id}/events` para reusar el flujo de undo y dejar audit trail.

export const PHASE_REGULAR = 'regular';
export const PHASE_PLAYIN = 'play-in';
export const PHASE_PLAYOFF = 'play-off';
export const PHASE_SEMIFINAL = 'semifinal';
export const PHASE_FINAL = 'final';

export const PHASE_LABEL = {
  [PHASE_REGULAR]: 'Fase regular',
  [PHASE_PLAYIN]: 'Play-in',
  [PHASE_PLAYOFF]: 'Play-off',
  [PHASE_SEMIFINAL]: 'Semifinal',
  [PHASE_FINAL]: 'Final',
};

export const PHASES = [
  PHASE_REGULAR,
  PHASE_PLAYIN,
  PHASE_PLAYOFF,
  PHASE_SEMIFINAL,
  PHASE_FINAL,
];

// Lee el contador de TMs usados de match.timeouts.{side}.{quarter}, tolerando
// booleans legacy.
export function timeoutsUsedIn(match, quarter, side) {
  const v = match?.timeouts?.[side]?.[quarter];
  if (typeof v === 'number') return v;
  if (v === true) return 1;
  return 0;
}

// Cupo configurado para un cuarto especifico segun la fase. Para cuartos en
// pool (final Q3+Q4) devuelve tambien la info del pool para que el caller
// pueda computar disponibilidad mirando los hermanos.
export function timeoutsAllowedFor(phase, quarter) {
  if (quarter >= 5) return { allowed: 1 };
  if (phase === PHASE_FINAL) {
    if (quarter <= 2) return { allowed: 1 };
    if (quarter === 3 || quarter === 4) {
      return {
        allowed: quarter === 4 ? 2 : 3,
        pool: { quarters: [3, 4], total: 3, capByQuarter: { 3: 3, 4: 2 } },
      };
    }
  }
  if (phase === PHASE_SEMIFINAL && quarter === 4) return { allowed: 2 };
  return { allowed: 1 };
}

// TMs todavia disponibles para sumar en este cuarto (>= 0).
export function timeoutsAvailableNow(match, quarter, side) {
  const phase = match?.phase || PHASE_REGULAR;
  const used = timeoutsUsedIn(match, quarter, side);
  const { allowed, pool } = timeoutsAllowedFor(phase, quarter);
  const remainingThisQ = Math.max(0, allowed - used);
  if (!pool) return remainingThisQ;
  const totalUsed = pool.quarters.reduce(
    (acc, q) => acc + timeoutsUsedIn(match, q, side),
    0,
  );
  const remainingTotal = Math.max(0, pool.total - totalUsed);
  return Math.min(remainingTotal, remainingThisQ);
}

// Path de Firestore para el contador de TMs de un (side, quarter).
export function timeoutFieldPath(side, quarter) {
  return `timeouts.${side}.${quarter}`;
}

// Penalizacion de TM por falta tecnica al banco. Reglamento: "pierde el
// minuto del cuarto o el siguiente. En ultimo cuarto, pierde el del proximo
// partido". Implementacion:
//   - Probar cuarto actual; si tiene disponibilidad, consumir alli.
//   - Si no, probar cuarto siguiente (mismas reglas).
//   - Si estamos en Q4 (ultimo cuarto regular) o en OT y no hay margen, queda
//     diferido — el caller decide que hacer (toast, marcar deuda, etc).
//
// Devuelve { applied, atQuarter, deferred }.
export function planBenchTechTimeoutPenalty(match, currentQuarter, side) {
  const isLastRegularOrOT = currentQuarter >= 4;
  const candidates = isLastRegularOrOT
    ? [currentQuarter]
    : [currentQuarter, currentQuarter + 1];
  for (const q of candidates) {
    if (timeoutsAvailableNow(match, q, side) > 0) {
      return { applied: true, atQuarter: q, deferred: false };
    }
  }
  return { applied: false, atQuarter: null, deferred: true };
}
