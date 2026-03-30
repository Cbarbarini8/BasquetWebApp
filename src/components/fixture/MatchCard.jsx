import LiveBadge from '../common/LiveBadge';

export default function MatchCard({ match, homeTeam, awayTeam }) {
  const isLive = match.status === 'live';
  const isFinished = match.status === 'finished';
  const isScheduled = match.status === 'scheduled';

  const formatDate = (date) => {
    if (!date) return '';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  return (
    <div
      className="rounded-lg p-4 transition-all"
      style={{
        backgroundColor: 'var(--color-bg-card)',
        border: isLive ? '2px solid var(--color-live)' : '1px solid var(--color-border)',
      }}
    >
      <div className="flex items-center justify-between">
        {/* Home team */}
        <div className="flex-1 text-right">
          <p className="font-semibold text-sm md:text-base" style={{ color: 'var(--color-text)' }}>
            {homeTeam?.name || 'TBD'}
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {homeTeam?.shortName || ''}
          </p>
        </div>

        {/* Score / Status */}
        <div className="flex flex-col items-center mx-4 min-w-[100px]">
          {isScheduled ? (
            <div className="text-center">
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                {match.scheduledTime || 'Horario TBD'}
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {formatDate(match.scheduledDate)}
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
                  {match.homeScore || 0}
                </span>
                <span className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>-</span>
                <span className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
                  {match.awayScore || 0}
                </span>
              </div>
              {isLive && (
                <div className="mt-1 flex items-center gap-2">
                  <LiveBadge />
                  {match.quarter && (
                    <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                      Q{match.quarter}
                    </span>
                  )}
                </div>
              )}
              {isFinished && (
                <span className="text-xs font-medium mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  FINAL
                </span>
              )}
            </>
          )}
        </div>

        {/* Away team */}
        <div className="flex-1 text-left">
          <p className="font-semibold text-sm md:text-base" style={{ color: 'var(--color-text)' }}>
            {awayTeam?.name || 'TBD'}
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {awayTeam?.shortName || ''}
          </p>
        </div>
      </div>
    </div>
  );
}
