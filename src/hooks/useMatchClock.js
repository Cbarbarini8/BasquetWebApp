import { useEffect, useState } from 'react';

// Basketball: 10 minutos por cuarto, 5 minutos por overtime (Q5+)
export const DEFAULT_QUARTER_MS = 10 * 60 * 1000;
export const DEFAULT_OT_MS = 5 * 60 * 1000;

export function defaultQuarterMs(quarter) {
  return quarter >= 5 ? DEFAULT_OT_MS : DEFAULT_QUARTER_MS;
}

export function formatClock(ms) {
  const totalSec = Math.max(0, Math.ceil((ms || 0) / 1000));
  const mm = Math.floor(totalSec / 60).toString().padStart(2, '0');
  const ss = (totalSec % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

// Hook que calcula el tiempo restante y tick local cuando el reloj esta corriendo.
// El reloj se modela como: base (clockRemainingMs) + opcional clockStartedAt (ms epoch).
// Si clockRunning es true, el restante es base - (now - clockStartedAt).
export function useMatchClock(match) {
  const running = !!match?.clockRunning;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running) return;
    // Reset "now" al arrancar: si el reloj estuvo pausado un rato, el state quedo viejo
    // y podria dar una lectura > base por un instante antes del primer tick del interval.
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [running]);

  if (!match) return { remainingMs: 0, mmss: '00:00', running: false };
  const base = typeof match.clockRemainingMs === 'number' ? match.clockRemainingMs : defaultQuarterMs(match.quarter || 1);
  let remaining = base;
  if (running && typeof match.clockStartedAt === 'number') {
    // Usamos el mayor entre "now" (state) y clockStartedAt para evitar que un "now"
    // obsoleto (anterior al inicio) haga que remaining supere a base.
    const effectiveNow = Math.max(now, match.clockStartedAt);
    remaining = Math.min(base, Math.max(0, base - (effectiveNow - match.clockStartedAt)));
  }
  return { remainingMs: remaining, mmss: formatClock(remaining), running };
}

// Dado el estado actual del match, pausa el reloj y devuelve la nueva base ms.
export function pausedRemainingFromMatch(match) {
  const base = typeof match?.clockRemainingMs === 'number' ? match.clockRemainingMs : defaultQuarterMs(match?.quarter || 1);
  if (match?.clockRunning && typeof match?.clockStartedAt === 'number') {
    return Math.max(0, base - (Date.now() - match.clockStartedAt));
  }
  return base;
}
