import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';

// UI compacta (celular landscape) para carga de stats en vivo.
// Flujo: el usuario arma un evento tocando el grid central y despues toca
// al jugador de cualquier equipo para imputar el evento.

function Jersey({ player, fouls, color, armed, onClick }) {
  const containerRef = useRef(null);
  const handleClick = () => {
    if (!armed || !containerRef.current) { onClick?.(); return; }
    const f = document.createElement('div');
    f.className = 'scoring-float-up';
    f.textContent = '✓';
    f.style.cssText = 'position:absolute;left:50%;top:0;pointer-events:none;font-weight:800;font-size:18px;color:var(--color-success);z-index:10;';
    containerRef.current.appendChild(f);
    setTimeout(() => f.remove(), 700);
    onClick?.();
  };
  return (
    <button
      ref={containerRef}
      type="button"
      onClick={handleClick}
      className={`relative flex flex-col items-center justify-center rounded-lg transition-transform active:scale-95 ${armed ? 'scoring-armed' : ''}`}
      style={{
        backgroundColor: color + '15',
        border: `2px solid ${color}`,
        color,
        minHeight: 0,
      }}
    >
      {fouls > 0 && (
        <span
          className="absolute top-0.5 right-0.5 font-bold rounded-full flex items-center justify-center text-[9px] w-3.5 h-3.5"
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
      <span className="font-bold leading-none text-lg">#{player.number}</span>
      <span className="truncate max-w-full text-[9px] leading-tight mt-0.5" style={{ opacity: 0.9 }}>
        {player.lastName}
      </span>
    </button>
  );
}

function EmptyJerseySlot() {
  return (
    <div
      className="rounded-lg"
      style={{
        border: '2px dashed var(--color-border)',
        backgroundColor: 'var(--color-bg-card)',
      }}
    />
  );
}

function TimeoutButton({ used, onClick, disabled, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="w-[18px] h-[18px] rounded-full inline-flex items-center justify-center font-bold leading-none transition-colors active:scale-90 disabled:cursor-default"
      style={{
        border: '1.5px solid rgba(255,255,255,0.6)',
        background: used ? 'var(--color-primary)' : 'transparent',
        borderColor: used ? 'var(--color-primary)' : 'rgba(255,255,255,0.6)',
        color: used ? '#ffffff' : 'rgba(255,255,255,0.9)',
        fontSize: 10,
        padding: 0,
      }}
    >
      T
    </button>
  );
}

function CourtEditorSheet({ side, teamName, teamColor, allPlayers, onCourtIds, onTogglePlayer, onClose, ejectionReason }) {
  return (
    <div className="absolute inset-0 z-40 flex items-end">
      <div
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(15,23,42,0.55)' }}
        onClick={onClose}
      />
      <div
        className="relative w-full scoring-sheet rounded-t-2xl shadow-2xl flex flex-col"
        style={{
          backgroundColor: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          maxHeight: '85%',
        }}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
              Editar cancha · {side === 'home' ? 'Local' : 'Visitante'}
            </p>
            <p className="text-sm font-bold truncate" style={{ color: 'var(--color-text)' }}>
              {teamName} · {onCourtIds.length}/5 en cancha
            </p>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-xs font-bold"
            style={{ backgroundColor: 'var(--color-primary)', color: '#ffffff' }}
          >
            Listo
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <div className="grid grid-cols-5 gap-2">
            {allPlayers.map(p => {
              const isOn = onCourtIds.includes(p.id);
              const ejectReason = ejectionReason?.(p.id);
              const disabled = !!ejectReason && !isOn;
              return (
                <button
                  key={p.id}
                  onClick={() => !disabled && onTogglePlayer(side, p.id)}
                  disabled={disabled}
                  className="relative flex flex-col items-center justify-center rounded-lg py-2 px-1 transition-transform active:scale-95 disabled:opacity-40"
                  style={{
                    backgroundColor: isOn ? teamColor : teamColor + '15',
                    border: `2px solid ${teamColor}`,
                    color: isOn ? '#ffffff' : teamColor,
                    minHeight: 56,
                  }}
                  title={ejectReason ? `Expulsado (${ejectReason})` : undefined}
                >
                  <span className="font-bold leading-none text-lg">#{p.number}</span>
                  <span className="truncate max-w-full text-[10px] leading-tight mt-0.5" style={{ opacity: 0.9 }}>
                    {p.lastName}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CompactScoringUI({
  match,
  events,
  homeTeam,
  awayTeam,
  homePlayers,
  awayPlayers,
  onCourtHomePlayers,
  onCourtAwayPlayers,
  onCourtHomeIds,
  onCourtAwayIds,
  eventButtons,
  eventLabel,
  playerPersonalFouls,
  homeTeamFouls,
  awayTeamFouls,
  ejectionReason,
  canEdit,
  // clock
  mmss,
  remainingMs,
  running,
  editingClock,
  clockInput,
  onClockInputChange,
  onOpenClockEdit,
  onSaveClockEdit,
  onCancelClockEdit,
  onToggleClock,
  onUpdateQuarter,
  onToggleTimeout,
  // event handlers
  onAddEvent,
  onUndoEvent,
  onTogglePlayerOnCourt,
  // court editor (controlado desde LiveScoring para poder abrirlo automaticamente al foul out)
  editingCourt,
  onSetEditingCourt,
}) {
  const [armedIdx, setArmedIdx] = useState(null);
  const [pinned, setPinned] = useState(false);

  // Solo un lado a la vez en compact. Prioridad home si ambos (caso raro).
  const sheetSide = editingCourt?.home ? 'home' : editingCourt?.away ? 'away' : null;

  const currentQuarter = match.quarter || 1;
  const homeTimeoutUsed = !!(match.timeouts?.home?.[currentQuarter]);
  const awayTimeoutUsed = !!(match.timeouts?.away?.[currentQuarter]);
  const homeBonus = homeTeamFouls >= 4;
  const awayBonus = awayTeamFouls >= 4;

  const armed = armedIdx !== null ? eventButtons[armedIdx] : null;
  const homeColor = homeTeam?.primaryColor || '#2563eb';
  const awayColor = awayTeam?.primaryColor || '#dc2626';

  const lastEvent = events[0];
  const lastPlayer = lastEvent
    ? (homePlayers.find(p => p.id === lastEvent.playerId) || awayPlayers.find(p => p.id === lastEvent.playerId))
    : null;

  const onEventTap = (idx) => {
    setArmedIdx(prev => (prev === idx ? null : idx));
  };

  const onJerseyTap = (side, playerId) => {
    if (!armed) return; // silencio total si no hay evento armado
    onAddEvent(side, armed, playerId);
    if (!pinned) setArmedIdx(null);
  };

  const openSheet = (side) => {
    if (!canEdit) return;
    onSetEditingCourt({ home: side === 'home', away: side === 'away' });
  };
  const closeSheet = () => onSetEditingCourt({ home: false, away: false });

  const renderJerseyColumn = (side) => {
    const players = side === 'home' ? onCourtHomePlayers : onCourtAwayPlayers;
    const color = side === 'home' ? homeColor : awayColor;
    return (
      <div className="relative grid grid-rows-5 gap-1 min-h-0">
        {Array.from({ length: 5 }).map((_, i) => {
          const p = players[i];
          if (!p) return <EmptyJerseySlot key={`empty-${side}-${i}`} />;
          return (
            <Jersey
              key={p.id}
              player={p}
              fouls={playerPersonalFouls[p.id] || 0}
              color={color}
              armed={!!armed}
              onClick={() => onJerseyTap(side, p.id)}
            />
          );
        })}
        {canEdit && (
          <button
            onClick={() => openSheet(side)}
            className="absolute w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shadow-md"
            style={{
              top: -4,
              [side === 'home' ? 'right' : 'left']: -4,
              backgroundColor: 'var(--color-bg-card)',
              color,
              border: `1px solid ${color}`,
              zIndex: 5,
            }}
            title="Editar jugadores en cancha"
          >
            ✎
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full overflow-hidden relative" style={{ backgroundColor: 'var(--color-bg)' }}>
      {/* ===== HEADER ===== */}
      <div
        className="shrink-0 grid items-center px-2 py-1 gap-2 text-white"
        style={{
          gridTemplateColumns: 'auto 1fr auto 1fr auto',
          background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
        }}
      >
        <Link
          to="/admin"
          className="shrink-0 w-7 h-7 flex items-center justify-center rounded text-white/85 text-sm font-bold"
          style={{ border: '1px solid rgba(255,255,255,0.3)' }}
          title="Volver"
        >
          ←
        </Link>

        {/* Home info */}
        <div className="min-w-0 flex items-center gap-2 justify-end">
          <div className="min-w-0 flex flex-col items-end gap-0.5">
            <p className="text-[11px] font-bold leading-none truncate max-w-[110px]" title={homeTeam?.name}>
              {homeTeam?.shortName || homeTeam?.name || 'Local'}
            </p>
            <div className="flex items-center gap-1.5 text-[9.5px] leading-none">
              <span
                className="px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: homeBonus ? 'var(--color-danger)' : 'rgba(255,255,255,0.08)',
                  border: homeBonus ? '1px solid var(--color-danger)' : '1px solid rgba(255,255,255,0.15)',
                  color: homeBonus ? '#ffffff' : '#cbd5e1',
                  fontWeight: homeBonus ? 700 : 400,
                }}
                title={homeBonus ? 'En bonus: proxima falta son tiros libres' : `Faltas equipo Q${currentQuarter}`}
              >
                F {Math.min(homeTeamFouls, 5)}/5{homeBonus ? ' · BONUS' : ''}
              </span>
              <TimeoutButton
                used={homeTimeoutUsed}
                onClick={() => onToggleTimeout('home')}
                disabled={!canEdit}
                title={`Tiempo muerto Q${currentQuarter} ${homeTimeoutUsed ? '(usado)' : '(disponible)'}`}
              />
            </div>
          </div>
          <p className="text-xl font-bold leading-none tabular-nums">{match.homeScore || 0}</p>
        </div>

        {/* Reloj + cuartos central */}
        <div className="shrink-0 flex flex-col items-center gap-0.5">
          {editingClock && canEdit ? (
            <div className="flex items-center gap-1 h-7">
              <input
                type="text"
                value={clockInput}
                onChange={e => onClockInputChange(e.target.value)}
                placeholder="MM:SS"
                autoFocus
                className="rounded text-center font-mono font-bold w-14 text-sm h-7 px-1"
                style={{
                  backgroundColor: '#ffffff',
                  color: '#111827',
                  caretColor: '#111827',
                  colorScheme: 'light',
                  border: '1px solid rgba(255,255,255,0.5)',
                }}
              />
              <button onClick={onSaveClockEdit} className="h-7 px-2 rounded bg-white text-gray-900 font-bold text-[11px]">OK</button>
              <button onClick={onCancelClockEdit} className="h-7 w-6 rounded bg-white/20 text-white font-bold text-[11px]">✕</button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span
                onDoubleClick={canEdit ? onOpenClockEdit : undefined}
                className="h-7 px-2 flex items-center rounded bg-white/10 font-mono font-bold tabular-nums text-lg leading-none select-none"
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
                    onClick={onToggleClock}
                    className={`w-7 h-7 rounded font-bold text-xs transition-colors ${running ? 'bg-white text-gray-900' : 'bg-white/25 text-white'}`}
                    title={running ? 'Pausar' : 'Iniciar'}
                  >
                    {running ? '❚❚' : '▶'}
                  </button>
                  <button
                    onClick={onOpenClockEdit}
                    className="w-7 h-7 rounded bg-white/15 text-white font-bold text-xs"
                    title="Editar tiempo"
                  >
                    ✎
                  </button>
                </>
              )}
            </div>
          )}
          <div className="flex gap-0.5">
            {[1, 2, 3, 4].map(q => (
              <button
                key={q}
                onClick={() => onUpdateQuarter(q)}
                disabled={!canEdit}
                className={`w-5 h-5 rounded font-bold text-[10px] transition-colors ${
                  match.quarter === q ? 'bg-white text-gray-900' : 'bg-white/20 text-white'
                }`}
              >
                {q}
              </button>
            ))}
            <button
              onClick={() => onUpdateQuarter(5)}
              disabled={!canEdit}
              className={`w-7 h-5 rounded font-bold text-[10px] transition-colors ${
                match.quarter === 5 ? 'bg-white text-gray-900' : 'bg-white/20 text-white'
              }`}
            >
              OT
            </button>
          </div>
        </div>

        {/* Away info */}
        <div className="min-w-0 flex items-center gap-2 justify-start">
          <p className="text-xl font-bold leading-none tabular-nums">{match.awayScore || 0}</p>
          <div className="min-w-0 flex flex-col items-start gap-0.5">
            <p className="text-[11px] font-bold leading-none truncate max-w-[110px]" title={awayTeam?.name}>
              {awayTeam?.shortName || awayTeam?.name || 'Visitante'}
            </p>
            <div className="flex items-center gap-1.5 text-[9.5px] leading-none">
              <span
                className="px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: awayBonus ? 'var(--color-danger)' : 'rgba(255,255,255,0.08)',
                  border: awayBonus ? '1px solid var(--color-danger)' : '1px solid rgba(255,255,255,0.15)',
                  color: awayBonus ? '#ffffff' : '#cbd5e1',
                  fontWeight: awayBonus ? 700 : 400,
                }}
                title={awayBonus ? 'En bonus: proxima falta son tiros libres' : `Faltas equipo Q${currentQuarter}`}
              >
                F {Math.min(awayTeamFouls, 5)}/5{awayBonus ? ' · BONUS' : ''}
              </span>
              <TimeoutButton
                used={awayTimeoutUsed}
                onClick={() => onToggleTimeout('away')}
                disabled={!canEdit}
                title={`Tiempo muerto Q${currentQuarter} ${awayTimeoutUsed ? '(usado)' : '(disponible)'}`}
              />
            </div>
          </div>
        </div>

        <div className="w-7" /> {/* espaciador simetrico a la flecha izquierda */}
      </div>

      {/* ===== BODY ===== */}
      <div
        className="flex-1 min-h-0 grid gap-1.5 p-1.5"
        style={{ gridTemplateColumns: '60px 1fr 60px' }}
      >
        {renderJerseyColumn('home')}

        {/* Grid central de eventos 4x4 */}
        {canEdit ? (
          <div className="grid grid-cols-4 grid-rows-4 gap-1 min-h-0">
            {eventButtons.map((btn, idx) => {
              const isArmed = armedIdx === idx;
              const isDimmed = armedIdx !== null && !isArmed;
              return (
                <button
                  key={idx}
                  onClick={() => onEventTap(idx)}
                  className={`rounded-md text-white font-bold transition-all active:scale-95 text-[11px] leading-none ${isArmed ? 'scoring-armed-btn' : ''} ${isDimmed ? 'opacity-45' : ''}`}
                  style={{ backgroundColor: btn.color, minHeight: 0, padding: 2 }}
                >
                  {btn.label}
                </button>
              );
            })}
          </div>
        ) : (
          <div
            className="rounded-md flex items-center justify-center text-xs"
            style={{ backgroundColor: 'var(--color-bg-hover)', color: 'var(--color-text-muted)' }}
          >
            Sin permisos para cargar eventos
          </div>
        )}

        {renderJerseyColumn('away')}
      </div>

      {/* ===== FOOTER ===== */}
      <div
        className="shrink-0 flex items-center gap-1.5 px-2 py-0.5 border-t text-[10.5px]"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-hover)' }}
      >
        <div className="shrink-0" style={{ color: 'var(--color-text-secondary)' }}>
          {armed ? (
            <b style={{ color: 'var(--color-primary)' }}>{armed.label}</b>
          ) : (
            <span style={{ color: 'var(--color-text-muted)' }}>—</span>
          )}
        </div>
        <div className="flex-1 text-center truncate" style={{ color: 'var(--color-text-secondary)' }}>
          {lastEvent && lastPlayer ? (
            <>#{lastPlayer.number} {lastPlayer.lastName} · {eventLabel(lastEvent)}</>
          ) : '—'}
        </div>
        {canEdit && (
          <button
            onClick={() => setPinned(p => !p)}
            className="px-1.5 py-0.5 rounded font-bold text-[10.5px]"
            style={{
              border: `1px solid ${pinned ? 'var(--color-primary)' : 'var(--color-border)'}`,
              backgroundColor: pinned ? 'var(--color-primary)' : '#ffffff',
              color: pinned ? '#ffffff' : 'var(--color-text-secondary)',
            }}
            title={pinned ? 'Fijado: el evento armado queda entre taps' : 'Fijar evento para cargar en rafaga'}
          >
            📌{pinned ? ' On' : ''}
          </button>
        )}
        {canEdit && lastEvent && (
          <button
            onClick={() => onUndoEvent(lastEvent)}
            className="px-1.5 py-0.5 rounded font-bold text-[10.5px]"
            style={{
              border: '1px solid var(--color-danger)',
              color: 'var(--color-danger)',
              backgroundColor: '#ffffff',
            }}
            title="Deshacer último evento"
          >
            ↶
          </button>
        )}
      </div>

      {/* ===== BOTTOM SHEET: editar cancha ===== */}
      {sheetSide && (
        <CourtEditorSheet
          side={sheetSide}
          teamName={(sheetSide === 'home' ? homeTeam : awayTeam)?.name || (sheetSide === 'home' ? 'Local' : 'Visitante')}
          teamColor={sheetSide === 'home' ? homeColor : awayColor}
          allPlayers={sheetSide === 'home' ? homePlayers : awayPlayers}
          onCourtIds={sheetSide === 'home' ? onCourtHomeIds : onCourtAwayIds}
          onTogglePlayer={onTogglePlayerOnCourt}
          onClose={closeSheet}
          ejectionReason={ejectionReason}
        />
      )}
    </div>
  );
}
