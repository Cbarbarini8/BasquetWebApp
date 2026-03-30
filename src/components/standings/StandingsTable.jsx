import TeamLogo from '../common/TeamLogo';

const PODIUM = {
  0: { bg: 'var(--color-podium-gold-bg)', border: 'var(--color-podium-gold-border)', badge: 'var(--color-podium-gold-badge)', label: '1' },
  1: { bg: 'var(--color-podium-silver-bg)', border: 'var(--color-podium-silver-border)', badge: 'var(--color-podium-silver-badge)', label: '2' },
  2: { bg: 'var(--color-podium-bronze-bg)', border: 'var(--color-podium-bronze-border)', badge: 'var(--color-podium-bronze-badge)', label: '3' },
};

export default function StandingsTable({ standings }) {
  return (
    <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--color-border)' }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ backgroundColor: 'var(--color-table-header)', color: '#ffffff' }}>
            <th className="px-3 py-3 text-center font-semibold w-10">#</th>
            <th className="px-3 py-3 text-left font-semibold">Equipo</th>
            <th className="px-3 py-3 text-center font-semibold">PJ</th>
            <th className="px-3 py-3 text-center font-semibold">PG</th>
            <th className="px-3 py-3 text-center font-semibold">PP</th>
            <th className="px-3 py-3 text-center font-semibold hidden sm:table-cell">PF</th>
            <th className="px-3 py-3 text-center font-semibold hidden sm:table-cell">PC</th>
            <th className="px-3 py-3 text-center font-semibold">Dif</th>
            <th className="px-3 py-3 text-center font-semibold">Pts</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row, idx) => {
            const podium = PODIUM[idx];
            return (
            <tr
              key={row.teamId}
              style={{
                backgroundColor: podium ? podium.bg : idx % 2 === 1 ? 'var(--color-table-row-alt)' : 'var(--color-bg-card)',
                borderBottom: '1px solid var(--color-border)',
                borderLeft: podium ? `3px solid ${podium.border}` : 'none',
              }}
            >
              <td className="px-3 py-3 text-center">
                {podium ? (
                  <span
                    className="inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-xs font-bold"
                    style={{ backgroundColor: podium.badge }}
                  >
                    {podium.label}
                  </span>
                ) : (
                  <span className="font-medium" style={{ color: 'var(--color-text-muted)' }}>{idx + 1}</span>
                )}
              </td>
              <td className="px-3 py-3">
                <div className="flex items-center gap-3">
                  <TeamLogo url={row.logoUrl} name={row.teamName} size={32} />
                  <span className="font-semibold" style={{ color: 'var(--color-text)' }}>
                    {row.teamName}
                  </span>
                </div>
              </td>
              <td className="px-3 py-3 text-center" style={{ color: 'var(--color-text-secondary)' }}>
                {row.played}
              </td>
              <td className="px-3 py-3 text-center font-medium" style={{ color: 'var(--color-success)' }}>
                {row.won}
              </td>
              <td className="px-3 py-3 text-center font-medium" style={{ color: 'var(--color-danger)' }}>
                {row.lost}
              </td>
              <td className="px-3 py-3 text-center hidden sm:table-cell" style={{ color: 'var(--color-text-secondary)' }}>
                {row.pointsFor}
              </td>
              <td className="px-3 py-3 text-center hidden sm:table-cell" style={{ color: 'var(--color-text-secondary)' }}>
                {row.pointsAgainst}
              </td>
              <td className="px-3 py-3 text-center font-medium" style={{ color: row.diff > 0 ? 'var(--color-success)' : row.diff < 0 ? 'var(--color-danger)' : 'var(--color-text-secondary)' }}>
                {row.diff > 0 ? '+' : ''}{row.diff}
              </td>
              <td className="px-3 py-3 text-center font-bold" style={{ color: 'var(--color-primary)' }}>
                {row.points}
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
