import { useState } from 'react';

const COLUMNS = [
  { key: 'playerName', label: 'Jugador', align: 'left', mobile: true },
  { key: 'teamName', label: 'Equipo', align: 'left', mobile: true },
  { key: 'gamesPlayed', label: 'PJ', align: 'center', mobile: true },
  { key: 'points', label: 'Pts', align: 'center', mobile: true },
  { key: 'twoMade', label: '2PC', align: 'center', mobile: false, format: (row) => `${row.twoMade}/${row.twoAttempted}` },
  { key: 'twoPct', label: '2P%', align: 'center', mobile: false },
  { key: 'threeMade', label: '3PC', align: 'center', mobile: false, format: (row) => `${row.threeMade}/${row.threeAttempted}` },
  { key: 'threePct', label: '3P%', align: 'center', mobile: false },
  { key: 'ftMade', label: 'TLC', align: 'center', mobile: false, format: (row) => `${row.ftMade}/${row.ftAttempted}` },
  { key: 'ftPct', label: 'TL%', align: 'center', mobile: false },
  { key: 'rebounds', label: 'Reb', align: 'center', mobile: true },
  { key: 'assists', label: 'Ast', align: 'center', mobile: false },
  { key: 'steals', label: 'Rob', align: 'center', mobile: false },
  { key: 'blocks', label: 'Tap', align: 'center', mobile: false },
  { key: 'turnovers', label: 'Per', align: 'center', mobile: false },
  { key: 'fouls', label: 'Fal', align: 'center', mobile: true },
];

export default function StatsTable({ stats, teams = [] }) {
  const [sortKey, setSortKey] = useState('points');
  const [sortDir, setSortDir] = useState('desc');
  const [filterTeam, setFilterTeam] = useState('');

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const filtered = filterTeam
    ? stats.filter(s => s.teamId === filterTeam)
    : stats;

  const sorted = [...filtered].sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    if (typeof aVal === 'string') {
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
  });

  return (
    <div>
      {teams.length > 0 && (
        <div className="mb-4">
          <select
            value={filterTeam}
            onChange={e => setFilterTeam(e.target.value)}
            className="px-3 py-2 rounded-md text-sm"
            style={{
              backgroundColor: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
            }}
          >
            <option value="">Todos los equipos</option>
            {teams.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--color-border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: 'var(--color-table-header)', color: '#ffffff' }}>
              {COLUMNS.map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className={`px-2 py-3 font-semibold cursor-pointer select-none whitespace-nowrap ${
                    col.align === 'left' ? 'text-left' : 'text-center'
                  } ${col.mobile ? '' : 'hidden lg:table-cell'}`}
                >
                  {col.label}
                  {sortKey === col.key && (
                    <span className="ml-1">{sortDir === 'desc' ? '\u25BC' : '\u25B2'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, idx) => (
              <tr
                key={row.playerId}
                style={{
                  backgroundColor: idx % 2 === 1 ? 'var(--color-table-row-alt)' : 'var(--color-bg-card)',
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                {COLUMNS.map(col => (
                  <td
                    key={col.key}
                    className={`px-2 py-2.5 whitespace-nowrap ${
                      col.align === 'left' ? 'text-left' : 'text-center'
                    } ${col.mobile ? '' : 'hidden lg:table-cell'} ${
                      col.key === 'playerName' ? 'font-semibold' : ''
                    } ${col.key === 'points' ? 'font-bold' : ''}`}
                    style={{
                      color: col.key === 'points' ? 'var(--color-primary)' : 'var(--color-text)',
                    }}
                  >
                    {col.format ? col.format(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
