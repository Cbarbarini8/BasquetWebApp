import { useState } from 'react';
import { collection, addDoc, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export default function TeamForm({ teams }) {
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [editingId, setEditingId] = useState(null);

  const resetForm = () => {
    setName('');
    setShortName('');
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    const data = {
      name: name.trim(),
      shortName: shortName.trim().toUpperCase() || name.trim().substring(0, 3).toUpperCase(),
    };

    if (editingId) {
      await updateDoc(doc(db, 'teams', editingId), data);
    } else {
      await addDoc(collection(db, 'teams'), { ...data, createdAt: serverTimestamp() });
    }
    resetForm();
  };

  const handleEdit = (team) => {
    setName(team.name);
    setShortName(team.shortName || '');
    setEditingId(team.id);
  };

  const handleDelete = async (teamId) => {
    if (window.confirm('Eliminar este equipo?')) {
      await deleteDoc(doc(db, 'teams', teamId));
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 mb-4">
        <input
          type="text"
          placeholder="Nombre del equipo"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          className="flex-1 min-w-[200px] px-3 py-2 rounded-md text-sm"
          style={{
            backgroundColor: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text)',
          }}
        />
        <input
          type="text"
          placeholder="Abrev. (ej: HAL)"
          value={shortName}
          onChange={e => setShortName(e.target.value)}
          maxLength={4}
          className="w-28 px-3 py-2 rounded-md text-sm"
          style={{
            backgroundColor: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text)',
          }}
        />
        <button
          type="submit"
          className="px-4 py-2 rounded-md text-white text-sm font-medium"
          style={{ backgroundColor: 'var(--color-btn-primary)' }}
        >
          {editingId ? 'Actualizar' : 'Agregar'}
        </button>
        {editingId && (
          <button
            type="button"
            onClick={resetForm}
            className="px-4 py-2 rounded-md text-sm font-medium"
            style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
          >
            Cancelar
          </button>
        )}
      </form>

      <div className="space-y-2">
        {teams.map(team => (
          <div
            key={team.id}
            className="flex items-center justify-between px-4 py-3 rounded-md"
            style={{
              backgroundColor: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div>
              <span className="font-medium" style={{ color: 'var(--color-text)' }}>{team.name}</span>
              <span className="ml-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {team.shortName}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleEdit(team)}
                className="text-xs px-2 py-1 rounded"
                style={{ color: 'var(--color-primary)' }}
              >
                Editar
              </button>
              <button
                onClick={() => handleDelete(team.id)}
                className="text-xs px-2 py-1 rounded"
                style={{ color: 'var(--color-danger)' }}
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
