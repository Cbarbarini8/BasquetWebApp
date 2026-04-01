import { useMemo } from 'react';
import MatchCard from './MatchCard';

function getDateKey(d) {
  if (!d) return null;
  const date = d.toDate ? d.toDate() : new Date(d);
  if (isNaN(date.getTime())) return null;
  return date.toISOString().split('T')[0];
}

function formatDayHeader(dateKey) {
  if (!dateKey) return 'Sin fecha asignada';
  const date = new Date(dateKey + 'T12:00:00');
  return date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function RoundGroup({ round, matches, teamsMap, courtsMap }) {
  const dayGroups = useMemo(() => {
    const groups = {};

    matches.forEach(match => {
      const key = getDateKey(match.scheduledDate) || '__none__';
      if (!groups[key]) groups[key] = [];
      groups[key].push(match);
    });

    // Sort date keys: real dates first (sorted asc), then __none__ at the end
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      if (a === '__none__') return 1;
      if (b === '__none__') return -1;
      return b.localeCompare(a);
    });

    return sortedKeys.map(key => ({
      dateKey: key,
      label: formatDayHeader(key === '__none__' ? null : key),
      matches: groups[key].sort((a, b) => {
        const timeA = a.scheduledTime || '99:99';
        const timeB = b.scheduledTime || '99:99';
        return timeB.localeCompare(timeA);
      }),
    }));
  }, [matches]);

  const hasMixedDates = dayGroups.length > 1 || (dayGroups.length === 1 && dayGroups[0].dateKey !== '__none__');

  return (
    <div className="mb-6">
      {round && (
        <h2
          className="text-sm font-bold uppercase tracking-wider mb-3 px-1"
          style={{ color: 'var(--color-primary)' }}
        >
          Fecha {round}
        </h2>
      )}

      {hasMixedDates ? (
        <div className="space-y-4">
          {dayGroups.map(group => (
            <div key={group.dateKey}>
              <p
                className="text-xs font-semibold uppercase tracking-wide mb-2 px-1 capitalize"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {group.label}
              </p>
              <div className="space-y-2">
                {group.matches.map(match => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    homeTeam={teamsMap[match.homeTeamId]}
                    awayTeam={teamsMap[match.awayTeamId]}
                    court={match.courtId ? courtsMap?.[match.courtId] : null}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {matches.map(match => (
            <MatchCard
              key={match.id}
              match={match}
              homeTeam={teamsMap[match.homeTeamId]}
              awayTeam={teamsMap[match.awayTeamId]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
