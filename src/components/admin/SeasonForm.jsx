import { useState } from 'react';
import { collection, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export default function SeasonForm({ seasons }) {
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState(null);

  const resetForm = () => {
    setName('');
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingId) {
      await updateDoc(doc(db, 'seasons', editingId), { name: name.trim() });
    } else {
      const isFirst = seasons.length === 0;
      await addDoc(collection(db, 'seasons'), {
        name: name.trim(),
        active: isFirst,
        createdAt: serverTimestamp(),
      });
    }
    resetForm();
  };

  const handleSetActive = async (seasonId) => {
    const batch = writeBatch(db);
    seasons.forEach(s => {
      batch.update(doc(db, 'seasons', s.id), { active: s.id === seasonId });
    });
    await batch.commit();
  };

  const handleDelete = async (seasonId) => {
    if (!window.confirm('Eliminar esta temporada? Los partidos asociados no se eliminan.')) return;
    await deleteDoc(doc(db, 'seasons', seasonId));
  };

  const handleEdit = (season) => {
    setName(season.name);
    setEditingId(season.id);
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 mb-6">
        <input
          type="text"
          placeholder="Nombre (ej: Torneo Apertura 2026)"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          className="flex-1 min-w-[250px] px-3 py-2 rounded-md text-sm"
          style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
        />
        <button
          type="submit"
          className="px-4 py-2 rounded-md text-white text-sm font-medium"
          style={{ backgroundColor: 'var(--color-btn-primary)' }}
        >
          {editingId ? 'Actualizar' : 'Crear temporada'}
        </button>
        {editingId && (
          <button
            type="button"
            onClick={resetForm}
            className="px-4 py-2 rounded-md text-sm"
            style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
          >
            Cancelar
          </button>
        )}
      </form>

      <div className="space-y-2">
        {seasons.map(season => (
          <div
            key={season.id}
            className="flex items-center justify-between px-4 py-3 rounded-md"
            style={{
              backgroundColor: 'var(--color-bg-card)',
              border: season.active ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
            }}
          >
            <div className="flex items-center gap-2">
              <span className="font-medium" style={{ color: 'var(--color-text)' }}>{season.name}</span>
              {season.active && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium text-white"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  Activa
                </span>
              )}
            </div>
            <div className="flex gap-2">
              {!season.active && (
                <button
                  onClick={() => handleSetActive(season.id)}
                  className="text-xs px-2 py-1 rounded font-medium"
                  style={{ color: 'var(--color-success)' }}
                >
                  Activar
                </button>
              )}
              <button onClick={() => handleEdit(season)} className="text-xs px-2 py-1 rounded" style={{ color: 'var(--color-primary)' }}>
                Editar
              </button>
              {!season.active && (
                <button onClick={() => handleDelete(season.id)} className="text-xs px-2 py-1 rounded" style={{ color: 'var(--color-danger)' }}>
                  Eliminar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
