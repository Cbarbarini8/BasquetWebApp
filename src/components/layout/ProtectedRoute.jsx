import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../common/LoadingSpinner';
import PageShell from './PageShell';

export default function ProtectedRoute({ children }) {
  const { user, userDoc, loading, isActive } = useAuth();

  if (loading) return <PageShell><LoadingSpinner /></PageShell>;
  if (!user) return <Navigate to="/admin/login" replace />;

  if (!userDoc) {
    return (
      <PageShell>
        <div className="text-center py-12">
          <p className="text-lg font-medium" style={{ color: 'var(--color-danger)' }}>
            Sin acceso
          </p>
          <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Tu cuenta no tiene permisos de administracion. Contacta al propietario.
          </p>
        </div>
      </PageShell>
    );
  }

  if (!isActive) {
    return (
      <PageShell>
        <div className="text-center py-12">
          <p className="text-lg font-medium" style={{ color: 'var(--color-danger)' }}>
            Cuenta desactivada
          </p>
          <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Tu cuenta fue desactivada. Contacta al propietario.
          </p>
        </div>
      </PageShell>
    );
  }

  return children;
}
