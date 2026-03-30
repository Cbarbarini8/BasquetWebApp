import { useTheme } from '../../context/ThemeContext';

export default function ThemeToggle() {
  const { theme, setTheme, themes } = useTheme();

  return (
    <div className="flex items-center gap-1 rounded-md p-0.5" style={{ backgroundColor: 'var(--color-nav-hover)' }}>
      {themes.map(t => (
        <button
          key={t.id}
          onClick={() => setTheme(t.id)}
          className="px-2 py-1 text-xs rounded font-medium transition-all"
          style={{
            backgroundColor: theme === t.id ? 'var(--color-nav-text)' : 'transparent',
            color: theme === t.id ? 'var(--color-nav-bg)' : 'var(--color-nav-text)',
            opacity: theme === t.id ? 1 : 0.7,
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
