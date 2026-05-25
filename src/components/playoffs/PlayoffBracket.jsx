import { useMemo, useRef, useLayoutEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import TeamLogo from '../common/TeamLogo';
import LiveBadge from '../common/LiveBadge';
import {
  BRACKET_COLUMNS,
  resolveMatchForBracket,
  slotLabel,
  PLAYOFF_TEMPLATE,
} from '../../lib/playoffs';

// Conexiones del bracket. De cuartos en adelante el cruce es FIJO (matchWinner
// en el template), asi que estas lineas son precisas. Las lineas pi→qf son
// indicativas: el reseed 7/8 decide que play-in alimenta cada cuarto. Ver el
// ASCII en `BRACKET_COLUMNS` (lib/playoffs.js).
//   pi-1 (7°v10°) ─┐
//   pi-2 (8°v9°)  ─┴→ qf-3 (1°v8°) / qf-4 (2°v7°)   (indicativo, reseed 7/8)
//   qf-3 (1°v8°)  ─┐
//   qf-1 (4°v5°)  ─┴→ sf-1
//   qf-2 (3°v6°)  ─┐
//   qf-4 (2°v7°)  ─┴→ sf-2
//   sf-1 + sf-2 → final
const CONNECTIONS = [
  { from: 'pi-1', to: 'qf-4' },
  { from: 'pi-2', to: 'qf-3' },
  { from: 'qf-3', to: 'sf-1' },
  { from: 'qf-1', to: 'sf-1' },
  { from: 'qf-2', to: 'sf-2' },
  { from: 'qf-4', to: 'sf-2' },
  { from: 'sf-1', to: 'final' },
  { from: 'sf-2', to: 'final' },
];

// Solo los cuartos con play-in son indicativos (el reseed 7/8 define que
// play-in los alimenta). De semis en adelante el cruce es fijo, sin tag.
const REORDER_HINT = {
  'qf-3': 'Reord. play-in',
  'qf-4': 'Reord. play-in',
};

function formatMatchDate(d) {
  if (!d) return '';
  const date = d.toDate ? d.toDate() : new Date(d);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
}

function BracketSlot({ slot, match, ctx, teamsMap, onOpen, slotRef }) {
  if (!match) {
    const tpl = PLAYOFF_TEMPLATE.find(t => t.slot === slot);
    if (!tpl) return null;
    return (
      <div
        ref={slotRef}
        className="rounded-md px-2 py-1.5"
        style={{
          backgroundColor: 'var(--color-bg-card)',
          border: '1px dashed var(--color-border)',
          minWidth: 180,
          opacity: 0.55,
        }}
      >
        <p className="text-[10px] uppercase font-bold mb-1" style={{ color: 'var(--color-text-muted)' }}>
          {slotLabel(slot)}
        </p>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>—</p>
      </div>
    );
  }

  const { homeTeamId, awayTeamId, homeLabel, awayLabel } = resolveMatchForBracket(match, ctx);
  const homeTeam = homeTeamId ? teamsMap[homeTeamId] : null;
  const awayTeam = awayTeamId ? teamsMap[awayTeamId] : null;
  const isLive = match.status === 'live';
  const isFinished = match.status === 'finished';
  const isWalkover = match.status === 'walkover';
  const isClickable = isLive || isFinished || isWalkover;
  const dateStr = formatMatchDate(match.scheduledDate);
  const homeScore = match.homeScore || 0;
  const awayScore = match.awayScore || 0;
  const homeWon = (isFinished || isWalkover) && homeScore > awayScore;
  const awayWon = (isFinished || isWalkover) && awayScore > homeScore;
  const reorderHint = REORDER_HINT[slot];

  // Seed (posicion en tabla regular) de cada equipo, si esta en el snapshot.
  // -1 si el teamId no esta en seeds (no deberia pasar para playoff valido).
  const seeds = ctx.seeds || [];
  const homeSeedIdx = homeTeamId ? seeds.indexOf(homeTeamId) : -1;
  const awaySeedIdx = awayTeamId ? seeds.indexOf(awayTeamId) : -1;

  const TeamRow = ({ team, label, score, won, isMissingId, seedIdx }) => (
    <div
      className="flex items-center gap-2 py-1"
      style={{ opacity: isMissingId ? 0.6 : 1 }}
    >
      {team ? <TeamLogo url={team.logoUrl} name={team.name} size={20} /> : (
        <div
          className="rounded-full shrink-0"
          style={{ width: 20, height: 20, backgroundColor: 'var(--color-bg-hover)', border: '1px dashed var(--color-border)' }}
        />
      )}
      {seedIdx >= 0 && (
        <span
          className="text-[10px] font-bold tabular-nums shrink-0"
          style={{ color: 'var(--color-text-muted)', minWidth: 16 }}
        >
          {seedIdx + 1}°
        </span>
      )}
      <span
        className="text-xs flex-1 truncate"
        style={{
          color: won ? 'var(--color-success)' : 'var(--color-text)',
          fontWeight: won ? 700 : 500,
        }}
      >
        {team?.shortName || team?.name || label || 'TBD'}
      </span>
      {!isMissingId && (isFinished || isLive || isWalkover) && (
        <span
          className="text-xs font-bold tabular-nums"
          style={{ color: won ? 'var(--color-success)' : 'var(--color-text-muted)' }}
        >
          {score}
        </span>
      )}
    </div>
  );

  return (
    <div
      ref={slotRef}
      onClick={() => isClickable && onOpen?.(match.id)}
      className="rounded-md px-2 py-1.5 transition-all relative"
      style={{
        backgroundColor: 'var(--color-bg-card)',
        border: isLive ? '2px solid var(--color-live)' : '1px solid var(--color-border)',
        cursor: isClickable ? 'pointer' : 'default',
        minWidth: 180,
      }}
    >
      <div className="flex items-center justify-between mb-1 gap-1">
        <p className="text-[10px] uppercase font-bold tracking-wide truncate" style={{ color: 'var(--color-text-muted)' }}>
          {slotLabel(slot)}
        </p>
        <div className="flex items-center gap-1 shrink-0">
          {reorderHint && (
            <span
              className="text-[9px] uppercase font-bold px-1 rounded"
              style={{
                backgroundColor: 'var(--color-bg-hover)',
                color: 'var(--color-accent)',
                border: '1px solid var(--color-accent)',
              }}
              title="El ganador del play-in que entra acá se define al terminar el play-in (reseed 7°/8° por tabla general) — la línea es indicativa."
            >
              Reord.
            </span>
          )}
          {isLive && <LiveBadge />}
          {isWalkover && (
            <span
              className="text-[10px] font-bold px-1 rounded text-white"
              style={{ backgroundColor: 'var(--color-warning)' }}
              title="Walkover"
            >
              WO
            </span>
          )}
        </div>
      </div>
      <TeamRow team={homeTeam} label={homeLabel} score={homeScore} won={homeWon} isMissingId={!homeTeamId} seedIdx={homeSeedIdx} />
      <TeamRow team={awayTeam} label={awayLabel} score={awayScore} won={awayWon} isMissingId={!awayTeamId} seedIdx={awaySeedIdx} />
      {dateStr && match.status === 'scheduled' && (
        <p className="text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
          {dateStr}{match.scheduledTime ? ` · ${match.scheduledTime}` : ''}
        </p>
      )}
    </div>
  );
}

export default function PlayoffBracket({ matches, teamsMap, seeds }) {
  const navigate = useNavigate();

  const playoffMatches = useMemo(
    () => (matches || []).filter(m => m.bracketSlot),
    [matches],
  );

  const matchBySlot = useMemo(() => {
    const map = {};
    playoffMatches.forEach(m => { map[m.bracketSlot] = m; });
    return map;
  }, [playoffMatches]);

  const ctx = useMemo(
    () => ({ seeds: seeds || [], playoffMatches }),
    [seeds, playoffMatches],
  );

  // Refs para medir posiciones de cada slot y dibujar las lineas SVG.
  const containerRef = useRef(null);
  const slotRefs = useRef({});
  const setSlotRef = useCallback((slot) => (el) => {
    if (el) slotRefs.current[slot] = el;
    else delete slotRefs.current[slot];
  }, []);
  const [paths, setPaths] = useState([]);
  const [svgSize, setSvgSize] = useState({ width: 0, height: 0 });

  const measure = useCallback(() => {
    const c = containerRef.current;
    if (!c) return;
    const cr = c.getBoundingClientRect();
    const lines = [];
    CONNECTIONS.forEach(({ from, to }) => {
      const a = slotRefs.current[from];
      const b = slotRefs.current[to];
      if (!a || !b) return;
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      const x1 = ar.right - cr.left;
      const y1 = ar.top + ar.height / 2 - cr.top;
      const x2 = br.left - cr.left;
      const y2 = br.top + br.height / 2 - cr.top;
      const midX = (x1 + x2) / 2;
      // Path: derecha del slot origen -> horizontal hasta midX -> vertical
      // hasta y del destino -> horizontal hasta izquierda del slot destino.
      lines.push(`M ${x1},${y1} H ${midX} V ${y2} H ${x2}`);
    });
    setPaths(lines);
    setSvgSize({ width: c.scrollWidth, height: c.scrollHeight });
  }, []);

  useLayoutEffect(() => {
    measure();
    if (typeof window === 'undefined') return;
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    Object.values(slotRefs.current).forEach(el => el && ro.observe(el));
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure, playoffMatches]);

  if (playoffMatches.length === 0) return null;

  return (
    <div className="mb-2">
      <div
        className="rounded-lg p-4"
        style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
      >
        <div className="overflow-x-auto pb-2">
          <div
            ref={containerRef}
            className="relative inline-block min-w-full"
          >
            {/* SVG con las lineas conectoras. pointer-events:none para no
                interferir con clicks sobre los slots. */}
            <svg
              className="absolute top-0 left-0 pointer-events-none"
              width={svgSize.width || '100%'}
              height={svgSize.height || '100%'}
              style={{ overflow: 'visible' }}
            >
              {paths.map((d, i) => (
                <path
                  key={i}
                  d={d}
                  stroke="var(--color-text-muted)"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.7"
                />
              ))}
            </svg>
            <div className="flex gap-6 relative">
              {BRACKET_COLUMNS.map(col => (
                <div key={col.id} className="flex flex-col gap-3 shrink-0">
                  <h3
                    className="text-xs font-bold uppercase tracking-wide pb-1"
                    style={{ color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}
                  >
                    {col.title}
                  </h3>
                  <div className="flex flex-col gap-6 flex-1 justify-around">
                    {col.slots.map(slot => (
                      <BracketSlot
                        key={slot}
                        slot={slot}
                        slotRef={setSlotRef(slot)}
                        match={matchBySlot[slot]}
                        ctx={ctx}
                        teamsMap={teamsMap}
                        onOpen={(id) => navigate(`/match/${id}`)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <p className="text-[10px] mt-2 px-1" style={{ color: 'var(--color-text-muted)' }}>
        Las líneas de cuartos en adelante son fijas. Los cruces marcados «Reord.»
        (cuartos con play-in) se definen al terminar el play-in: sus ganadores se
        reordenan en 7°/8° según la tabla general.
      </p>
    </div>
  );
}
