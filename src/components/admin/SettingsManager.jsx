import { useEffect, useState } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useDocument } from '../../hooks/useDocument';
import { useToast } from '../../context/ToastContext';
import { logAction } from '../../lib/audit';
import { HIDEABLE_STATS_COLUMNS } from '../../lib/statsColumns';
import LoadingSpinner from '../common/LoadingSpinner';

export default function SettingsManager({ user }) {
  const { toast } = useToast();
  const { data: statsConfig, loading } = useDocument('config/stats');
  const [hidden, setHidden] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Sincronizar estado local cuando llega/cambia la config remota
  useEffect(() => {
    if (loading) return;
    const remote = new Set(statsConfig?.hiddenColumns || []);
    setHidden(remote);
    setDirty(false);
  }, [statsConfig, loading]);

  const toggle = (key) => {
    setHidden(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const hiddenColumns = Array.from(hidden);
      await setDoc(doc(db, 'config/stats'), {
        hiddenColumns,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      await logAction(user, 'update', 'config', 'stats', `Columnas ocultas en /stats: ${hiddenColumns.length === 0 ? 'ninguna' : hiddenColumns.join(', ')}`);
      toast.success('Visibilidad guardada');
      setDirty(false);
    } catch (err) {
      console.error('Error al guardar visibilidad de columnas:', err);
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <section
        className="p-4 rounded-lg"
        style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
      >
        <h3 className="font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
          Visibilidad de columnas en /stats
        </h3>
        <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
          Marcá las columnas que querés mostrar al público en la pagina de estadisticas. Los datos se siguen registrando igual.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {HIDEABLE_STATS_COLUMNS.map(col => {
            const visible = !hidden.has(col.key);
            return (
              <label
                key={col.key}
                className="flex items-center gap-2 px-3 py-2 rounded cursor-pointer text-sm"
                style={{
                  backgroundColor: 'var(--color-bg-hover)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                }}
              >
                <input
                  type="checkbox"
                  checked={visible}
                  onChange={() => toggle(col.key)}
                />
                <span>{col.label}</span>
              </label>
            );
          })}
        </div>
        <div className="flex items-center gap-2 mt-4">
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="px-4 py-2 rounded-md text-white text-sm font-medium disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-btn-primary)' }}
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
          {dirty && !saving && (
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Hay cambios sin guardar
            </span>
          )}
        </div>
      </section>
    </div>
  );
}
