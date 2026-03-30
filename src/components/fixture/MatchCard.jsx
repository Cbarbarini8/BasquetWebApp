import { useNavigate } from 'react-router-dom';
import LiveBadge from '../common/LiveBadge';
import TeamLogo from '../common/TeamLogo';

export default function MatchCard({ match, homeTeam, awayTeam, court }) {
  const navigate = useNavigate();
  const isLive = match.status === 'live';
  const isFinished = match.status === 'finished';
  const isScheduled = match.status === 'scheduled';
  const isClickable = isLive || isFinished;

  const hasDate = match.scheduledDate != null;

  const handleClick = () => {
    if (isClickable) navigate(`/match/${match.id}`);
  };

  return (
    <div
      onClick={handleClick}
      className="rounded-lg p-4 transition-all"
      style={{
        backgroundColor: 'var(--color-bg-card)',
        border: isLive ? '2px solid var(--color-live)' : '1px solid var(--color-border)',
        cursor: isClickable ? 'pointer' : 'default',
      }}
    >
      <div className="flex items-center justify-between">
        {/* Home team */}
        <div className="flex-1 flex items-center justify-end gap-2">
          <div className="text-right">
            <p className="font-semibold text-sm md:text-base" style={{ color: 'var(--color-text)' }}>
              {homeTeam?.name || 'TBD'}
            </p>
          </div>
          <TeamLogo url={homeTeam?.logoUrl} name={homeTeam?.name} size={36} />
        </div>

        {/* Score / Status */}
        <div className="flex flex-col items-center mx-4 min-w-[100px]">
          {isScheduled ? (
            <div className="text-center">
              {hasDate ? (
                <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  {match.scheduledTime || 'Horario TBD'}
                </p>
              ) : (
                <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                  Por programar
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold" style={{
                  color: isFinished && (match.homeScore || 0) > (match.awayScore || 0) ? 'var(--color-success)' :
                         isFinished && (match.homeScore || 0) < (match.awayScore || 0) ? 'var(--color-text-muted)' :
                         'var(--color-text)',
                }}>
                  {match.homeScore || 0}
                </span>
                <span className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>-</span>
                <span className="text-2xl font-bold" style={{
                  color: isFinished && (match.awayScore || 0) > (match.homeScore || 0) ? 'var(--color-success)' :
                         isFinished && (match.awayScore || 0) < (match.homeScore || 0) ? 'var(--color-text-muted)' :
                         'var(--color-text)',
                }}>
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
        <div className="flex-1 flex items-center gap-2">
          <TeamLogo url={awayTeam?.logoUrl} name={awayTeam?.name} size={36} />
          <div className="text-left">
            <p className="font-semibold text-sm md:text-base" style={{ color: 'var(--color-text)' }}>
              {awayTeam?.name || 'TBD'}
            </p>
          </div>
        </div>
      </div>

      {/* Court info */}
      {court && (
        <div className="mt-2 text-center">
          {court.mapsUrl ? (
            <a
              href={court.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="text-xs inline-flex items-center gap-1 underline"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {court.name}
            </a>
          ) : (
            <span className="text-xs inline-flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {court.name}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
