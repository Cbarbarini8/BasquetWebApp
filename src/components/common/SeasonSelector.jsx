export default function SeasonSelector({ seasons, selectedId, onChange }) {
  if (seasons.length <= 1) return null;

  return (
    <select
      value={selectedId}
      onChange={e => onChange(e.target.value)}
      className="px-3 py-2 rounded-md text-sm font-medium"
      style={{
        backgroundColor: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
        color: 'var(--color-text)',
      }}
    >
      {seasons.map(s => (
        <option key={s.id} value={s.id}>
          {s.name}{s.active ? ' (actual)' : ''}
        </option>
      ))}
    </select>
  );
}
