import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../common/LoadingSpinner';
import PageShell from './PageShell';

function AccessDenied({ title, message }) {
  const { logout } = useAuth();
  return (
    <PageShell>
      <div className="text-center py-12">
        <p className="text-lg font-medium" style={{ color: 'var(--color-danger)' }}>{title}</p>
        <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>{message}</p>
        <button
          onClick={logout}
          className="mt-4 text-sm px-4 py-2 rounded-md"
          style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
        >
          Cerrar sesion
        </button>
      </div>
    </PageShell>
  );
}

export default function ProtectedRoute({ children }) {
  const { user, userDoc, loading, isActive } = useAuth();

  if (loading) return <PageShell><LoadingSpinner /></PageShell>;
  if (!user) return <Navigate to="/admin/login" replace />;

  if (!userDoc) {
    return <AccessDenied title="Sin acceso" message="Tu cuenta no tiene permisos de administracion. Contacta al propietario." />;
  }

  if (!isActive) {
    return <AccessDenied title="Cuenta desactivada" message="Tu cuenta fue desactivada. Contacta al propietario." />;
  }

  return children;
}
