export default function StandingsTable({ standings }) {
  return (
    <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--color-border)' }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ backgroundColor: 'var(--color-table-header)', color: '#ffffff' }}>
            <th className="px-3 py-3 text-left font-semibold">#</th>
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
          {standings.map((row, idx) => (
            <tr
              key={row.teamId}
              style={{
                backgroundColor: idx % 2 === 1 ? 'var(--color-table-row-alt)' : 'var(--color-bg-card)',
                borderBottom: '1px solid var(--color-border)',
              }}
            >
              <td className="px-3 py-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>
                {idx + 1}
              </td>
              <td className="px-3 py-3 font-semibold" style={{ color: 'var(--color-text)' }}>
                {row.teamName}
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
          ))}
        </tbody>
      </table>
    </div>
  );
}
