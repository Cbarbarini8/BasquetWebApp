import { useState } from 'react';
import { collection, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { logAction } from '../../lib/audit';
import { IconButton, EditIcon, DeleteIcon, CheckIcon } from '../common/Icons';

export default function SeasonForm({ seasons, canEdit, user }) {
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState(null);

  const resetForm = () => { setName(''); setEditingId(null); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingId) {
      await updateDoc(doc(db, 'seasons', editingId), { name: name.trim() });
      await logAction(user, 'update', 'seasons', editingId, `Edito temporada: ${name.trim()}`);
    } else {
      const isFirst = seasons.length === 0;
      const ref = await addDoc(collection(db, 'seasons'), { name: name.trim(), active: isFirst, createdAt: serverTimestamp() });
      await logAction(user, 'create', 'seasons', ref.id, `Creo temporada: ${name.trim()}`);
    }
    resetForm();
  };

  const handleSetActive = async (seasonId) => {
    const batch = writeBatch(db);
    seasons.forEach(s => { batch.update(doc(db, 'seasons', s.id), { active: s.id === seasonId }); });
    await batch.commit();
    const s = seasons.find(x => x.id === seasonId);
    await logAction(user, 'update', 'seasons', seasonId, `Activo temporada: ${s?.name}`);
  };

  const handleDelete = async (season) => {
    if (!window.confirm('Eliminar esta temporada?')) return;
    await deleteDoc(doc(db, 'seasons', season.id));
    await logAction(user, 'delete', 'seasons', season.id, `Elimino temporada: ${season.name}`);
  };

  const handleEdit = (season) => { setName(season.name); setEditingId(season.id); };

  return (
    <div>
      {canEdit && (
        <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 mb-6">
          <input type="text" placeholder="Nombre (ej: Torneo Apertura 2026)" value={name} onChange={e => setName(e.target.value)} required
            className="flex-1 min-w-[250px] px-3 py-2 rounded-md text-sm"
            style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} />
          <button type="submit" className="px-4 py-2 rounded-md text-white text-sm font-medium" style={{ backgroundColor: 'var(--color-btn-primary)' }}>
            {editingId ? 'Actualizar' : 'Crear temporada'}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="px-4 py-2 rounded-md text-sm"
              style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>Cancelar</button>
          )}
        </form>
      )}
      <div className="space-y-2">
        {seasons.map(season => (
          <div key={season.id} className="flex items-center justify-between px-4 py-3 rounded-md"
            style={{ backgroundColor: 'var(--color-bg-card)', border: season.active ? '2px solid var(--color-primary)' : '1px solid var(--color-border)' }}>
            <div className="flex items-center gap-2">
              <span className="font-medium" style={{ color: 'var(--color-text)' }}>{season.name}</span>
              {season.active && <span className="text-xs px-2 py-0.5 rounded-full font-medium text-white" style={{ backgroundColor: 'var(--color-primary)' }}>Activa</span>}
            </div>
            {canEdit && (
              <div className="flex gap-1">
                {!season.active && <IconButton icon={CheckIcon} label="Activar" onClick={() => handleSetActive(season.id)} color="var(--color-success)" />}
                <IconButton icon={EditIcon} label="Editar" onClick={() => handleEdit(season)} />
                {!season.active && <IconButton icon={DeleteIcon} label="Eliminar" onClick={() => handleDelete(season)} color="var(--color-danger)" />}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
