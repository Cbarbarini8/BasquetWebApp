import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ThemeToggle from './ThemeToggle';

export default function Navbar() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const links = [
    { to: '/', label: 'Fixture' },
    { to: '/standings', label: 'Posiciones' },
    { to: '/stats', label: 'Estadisticas' },
  ];

  const isActive = (path) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

  return (
    <nav style={{ backgroundColor: 'var(--color-nav-bg)', color: 'var(--color-nav-text)' }}>
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <Link to="/" className="font-bold text-lg tracking-tight" style={{ color: 'var(--color-nav-text)' }}>
            Torneo Basquet
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {links.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className="px-3 py-2 rounded-md text-sm font-medium transition-colors"
                style={{
                  backgroundColor: isActive(link.to) ? 'var(--color-nav-hover)' : 'transparent',
                  color: 'var(--color-nav-text)',
                }}
              >
                {link.label}
              </Link>
            ))}
            <div className="w-px h-6 mx-2" style={{ backgroundColor: 'var(--color-nav-hover)' }} />
            <ThemeToggle />
            <Link
              to={user ? '/admin' : '/admin/login'}
              className="px-3 py-2 rounded-md text-sm font-medium transition-colors"
              style={{
                backgroundColor: pathname.startsWith('/admin') ? 'var(--color-nav-hover)' : 'transparent',
                color: 'var(--color-nav-text)',
              }}
            >
              {user ? 'Admin' : 'Login'}
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 rounded-md"
            style={{ color: 'var(--color-nav-text)' }}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden pb-3 space-y-1">
            {links.map(link => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2 rounded-md text-sm font-medium"
                style={{
                  backgroundColor: isActive(link.to) ? 'var(--color-nav-hover)' : 'transparent',
                  color: 'var(--color-nav-text)',
                }}
              >
                {link.label}
              </Link>
            ))}
            <Link
              to={user ? '/admin' : '/admin/login'}
              onClick={() => setMenuOpen(false)}
              className="block px-3 py-2 rounded-md text-sm font-medium"
              style={{
                backgroundColor: pathname.startsWith('/admin') ? 'var(--color-nav-hover)' : 'transparent',
                color: 'var(--color-nav-text)',
              }}
            >
              {user ? 'Admin' : 'Login'}
            </Link>
            <div className="px-3 py-2">
              <ThemeToggle />
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
