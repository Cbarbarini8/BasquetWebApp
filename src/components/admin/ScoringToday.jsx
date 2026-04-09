import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, doc, updateDoc, writeBatch, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { logAction } from '../../lib/audit';
import TeamLogo from '../common/TeamLogo';
import EmptyState from '../common/EmptyState';
import LiveBadge from '../common/LiveBadge';

function getDateKey(d) {
  if (!d) return null;
  const date = d.toDate ? d.toDate() : new Date(d);
  if (isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getTodayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function ScoringToday({ matches, teamsMap, courtsMap, canEdit, user }) {
  const navigate = useNavigate();
  const todayKey = getTodayKey();

  const todayMatches = useMemo(() => {
    return matches
      .filter(m => {
        // Siempre incluir partidos en vivo (por si se estiraron al dia siguiente)
        if (m.status === 'live') return true;
        if (m.status === 'finished') return false;
        const key = getDateKey(m.scheduledDate);
        return key === todayKey;
      })
      .sort((a, b) => {
        // En vivo primero, despues por horario ascendente
        if (a.status === 'live' && b.status !== 'live') return -1;
        if (b.status === 'live' && a.status !== 'live') return 1;
        const ta = a.scheduledTime || '99:99';
        const tb = b.scheduledTime || '99:99';
        return ta.localeCompare(tb);
      });
  }, [matches, todayKey]);

  const startMatch = async (matchId) => {
    const m = matches.find(x => x.id === matchId);
    const home = teamsMap[m?.homeTeamId]?.name || 'TBD';
    const away = teamsMap[m?.awayTeamId]?.name || 'TBD';
    await updateDoc(doc(db, 'matches', matchId), {
      status: 'live',
      quarter: 1,
      homeScore: 0,
      awayScore: 0,
      startedAt: serverTimestamp(),
    });
    if (user) await logAction(user, 'start', 'matches', matchId, `Inicio partido: ${home} vs ${away}`);
    navigate(`/admin/match/${matchId}`);
  };

  const resetMatch = async (matchId) => {
    if (!window.confirm('Resetear este partido a programado? Se eliminaran todas las estadisticas cargadas.')) return;
    const m = matches.find(x => x.id === matchId);
    const home = teamsMap[m?.homeTeamId]?.name || 'TBD';
    const away = teamsMap[m?.awayTeamId]?.name || 'TBD';
    const eventsSnap = await getDocs(collection(db, `matches/${matchId}/events`));
    const batch = writeBatch(db);
    eventsSnap.docs.forEach(d => batch.delete(d.ref));
    batch.update(doc(db, 'matches', matchId), {
      status: 'scheduled',
      homeScore: 0,
      awayScore: 0,
      quarter: 0,
      startedAt: null,
      finishedAt: null,
      onCourtHome: [],
      onCourtAway: [],
    });
    await batch.commit();
    if (user) await logAction(user, 'reset', 'matches', matchId, `Reseteo partido: ${home} vs ${away} (${eventsSnap.size} eventos eliminados)`);
  };

  const todayLabel = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

  if (todayMatches.length === 0) {
    return (
      <div>
        <p className="text-sm capitalize mb-4" style={{ color: 'var(--color-text-secondary)' }}>{todayLabel}</p>
        <EmptyState message="No hay partidos programados para hoy" />
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm capitalize mb-4" style={{ color: 'var(--color-text-secondary)' }}>{todayLabel}</p>
      <div className="space-y-3">
        {todayMatches.map(match => {
          const home = teamsMap[match.homeTeamId];
          const away = teamsMap[match.awayTeamId];
          const court = match.courtId ? courtsMap?.[match.courtId] : null;
          const isLive = match.status === 'live';
          const isScheduled = match.status === 'scheduled';

          return (
            <div
              key={match.id}
              className="rounded-lg p-4"
              style={{
                backgroundColor: 'var(--color-bg-card)',
                border: isLive ? '2px solid var(--color-live)' : '1px solid var(--color-border)',
              }}
            >
              <div className="flex items-center justify-between gap-3">
                {/* Home */}
                <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
                  <div className="text-right min-w-0">
                    <p className="font-semibold text-sm md:text-base truncate" style={{ color: 'var(--color-text)' }}>
                      <span className="hidden sm:inline">{home?.name || 'TBD'}</span>
                      <span className="sm:hidden">{home?.shortName || home?.name || 'TBD'}</span>
                    </p>
                  </div>
                  <TeamLogo url={home?.logoUrl} name={home?.name} size={40} />
                </div>

                {/* Center */}
                <div className="flex flex-col items-center px-1 md:px-3 min-w-[80px] md:min-w-[110px]">
                  {isLive ? (
                    <>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
                          {match.homeScore || 0}
                        </span>
                        <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>-</span>
                        <span className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
                          {match.awayScore || 0}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <LiveBadge />
                        {match.quarter && (
                          <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                            Q{match.quarter}
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>
                        {match.scheduledTime || '--'}
                      </span>
                      {court && (
                        <span className="text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
                          {court.name}
                        </span>
                      )}
                    </>
                  )}
                </div>

                {/* Away */}
                <div className="flex-1 flex items-center gap-2 min-w-0">
                  <TeamLogo url={away?.logoUrl} name={away?.name} size={40} />
                  <div className="text-left min-w-0">
                    <p className="font-semibold text-sm md:text-base truncate" style={{ color: 'var(--color-text)' }}>
                      <span className="hidden sm:inline">{away?.name || 'TBD'}</span>
                      <span className="sm:hidden">{away?.shortName || away?.name || 'TBD'}</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
                {isScheduled && canEdit && (
                  <button
                    onClick={() => startMatch(match.id)}
                    className="px-4 py-2 rounded-md text-white text-sm font-medium"
                    style={{ backgroundColor: 'var(--color-success)' }}
                  >
                    Iniciar partido
                  </button>
                )}
                {isScheduled && !canEdit && (
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    Sin permisos para iniciar
                  </span>
                )}
                {isLive && (
                  <>
                    <button
                      onClick={() => navigate(`/admin/match/${match.id}`)}
                      className="px-4 py-2 rounded-md text-white text-sm font-medium"
                      style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                      Ir a planilla
                    </button>
                    {canEdit && (
                      <button
                        onClick={() => resetMatch(match.id)}
                        className="px-4 py-2 rounded-md text-sm font-medium"
                        style={{ border: '1px solid var(--color-danger)', color: 'var(--color-danger)' }}
                      >
                        Resetear
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
