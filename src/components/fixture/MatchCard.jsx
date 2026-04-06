import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LiveBadge from '../common/LiveBadge';
import TeamLogo from '../common/TeamLogo';

export default function MatchCard({ match, homeTeam, awayTeam, court }) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const isLive = match.status === 'live';
  const isFinished = match.status === 'finished';
  const isScheduled = match.status === 'scheduled';
  const isClickable = isLive || isFinished;

  const handleCopyLink = (e) => {
    e.stopPropagation();
    const url = `${window.location.origin}/match/${match.id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
        <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
          <div className="text-right min-w-0">
            <p className="font-semibold text-sm md:text-base truncate" style={{ color: 'var(--color-text)' }}>
              <span className="hidden md:inline">{homeTeam?.name || 'TBD'}</span>
              <span className="md:hidden">{homeTeam?.shortName || homeTeam?.name || 'TBD'}</span>
            </p>
          </div>
          <TeamLogo url={homeTeam?.logoUrl} name={homeTeam?.name} size={36} />
        </div>

        {/* Score / Status */}
        <div className="flex flex-col items-center mx-2 md:mx-4 min-w-[80px] md:min-w-[100px]">
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
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <TeamLogo url={awayTeam?.logoUrl} name={awayTeam?.name} size={36} />
          <div className="text-left min-w-0">
            <p className="font-semibold text-sm md:text-base truncate" style={{ color: 'var(--color-text)' }}>
              <span className="hidden md:inline">{awayTeam?.name || 'TBD'}</span>
              <span className="md:hidden">{awayTeam?.shortName || awayTeam?.name || 'TBD'}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Footer: court + share */}
      {(court || isClickable) && (
        <div className="mt-2 flex items-center justify-between">
          <div className="flex-1" />
          {court && (
            <div className="flex-1 text-center">
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
          <div className="flex-1 flex justify-end">
            {isClickable && (
              <button
                onClick={handleCopyLink}
                title={copied ? 'Copiado!' : 'Copiar link'}
                className="p-1.5 rounded-full transition-opacity hover:opacity-80"
                style={{ color: copied ? 'var(--color-success)' : 'var(--color-text-muted)' }}
              >
                {copied ? (
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" />
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                  </svg>
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
