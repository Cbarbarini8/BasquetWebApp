import MatchCard from './MatchCard';

export default function RoundGroup({ round, matches, teamsMap }) {
  return (
    <div className="mb-6">
      <h2
        className="text-sm font-bold uppercase tracking-wider mb-3 px-1"
        style={{ color: 'var(--color-primary)' }}
      >
        Fecha {round}
      </h2>
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
    </div>
  );
}
