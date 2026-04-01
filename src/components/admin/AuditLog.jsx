import { useState, useMemo } from 'react';
import { orderBy, limit, where } from 'firebase/firestore';
import { useCollection } from '../../hooks/useCollection';

const ACTION_LABELS = {
  create: 'Crear',
  update: 'Editar',
  delete: 'Eliminar',
  approve: 'Aprobar',
  reject: 'Rechazar',
  start: 'Iniciar',
  finish: 'Finalizar',
  reset: 'Resetear',
};

const ACTION_COLORS = {
  create: 'var(--color-success)',
  update: 'var(--color-primary)',
  delete: 'var(--color-danger)',
  approve: 'var(--color-success)',
  reject: 'var(--color-danger)',
  start: 'var(--color-success)',
  finish: 'var(--color-warning)',
  reset: 'var(--color-text-muted)',
};

export default function AuditLog() {
  const [filterCollection, setFilterCollection] = useState('');
  const constraints = [orderBy('timestamp', 'desc'), limit(200)];
  if (filterCollection) {
    constraints.unshift(where('collection', '==', filterCollection));
  }

  const { data: logs, loading } = useCollection('auditLog', constraints);

  const collections = useMemo(() => {
    const set = new Set(logs.map(l => l.collection));
    return [...set].sort();
  }, [logs]);

  const formatDate = (ts) => {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const inputStyle = { backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text)' };

  return (
    <div>
      <div className="mb-4">
        <select value={filterCollection} onChange={e => setFilterCollection(e.target.value)}
          className="px-3 py-2 rounded-md text-sm" style={inputStyle}>
          <option value="">Todas las secciones</option>
          {collections.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {loading ? (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Cargando...</p>
      ) : logs.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>No hay registros de auditoria</p>
      ) : (
        <div className="space-y-1">
          {logs.map(log => (
            <div key={log.id} className="flex flex-wrap items-start gap-2 px-4 py-2.5 rounded-md text-sm"
              style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
              <span className="text-xs shrink-0" style={{ color: 'var(--color-text-muted)' }}>
                {formatDate(log.timestamp)}
              </span>
              <span className="text-xs px-1.5 py-0.5 rounded-full font-medium text-white shrink-0"
                style={{ backgroundColor: ACTION_COLORS[log.action] || 'var(--color-text-muted)' }}>
                {ACTION_LABELS[log.action] || log.action}
              </span>
              <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                {log.userEmail}
              </span>
              <span className="text-xs flex-1" style={{ color: 'var(--color-text)' }}>
                {log.description}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
