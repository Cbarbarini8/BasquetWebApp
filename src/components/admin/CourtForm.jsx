import { useState } from 'react';
import { collection, addDoc, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export default function CourtForm({ courts }) {
  const [name, setName] = useState('');
  const [mapsUrl, setMapsUrl] = useState('');
  const [editingId, setEditingId] = useState(null);

  const resetForm = () => {
    setName('');
    setMapsUrl('');
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    const data = {
      name: name.trim(),
      mapsUrl: mapsUrl.trim(),
    };

    if (editingId) {
      await updateDoc(doc(db, 'courts', editingId), data);
    } else {
      await addDoc(collection(db, 'courts'), { ...data, createdAt: serverTimestamp() });
    }
    resetForm();
  };

  const handleEdit = (court) => {
    setName(court.name);
    setMapsUrl(court.mapsUrl || '');
    setEditingId(court.id);
  };

  const handleDelete = async (courtId) => {
    if (window.confirm('Eliminar esta cancha?')) {
      await deleteDoc(doc(db, 'courts', courtId));
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-3 mb-6">
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Nombre de la cancha"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            className="flex-1 min-w-[200px] px-3 py-2 rounded-md text-sm"
            style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
          />
        </div>
        <input
          type="url"
          placeholder="Link de Google Maps (opcional)"
          value={mapsUrl}
          onChange={e => setMapsUrl(e.target.value)}
          className="w-full px-3 py-2 rounded-md text-sm"
          style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
        />
        <div className="flex gap-2">
          <button
            type="submit"
            className="px-4 py-2 rounded-md text-white text-sm font-medium"
            style={{ backgroundColor: 'var(--color-btn-primary)' }}
          >
            {editingId ? 'Actualizar' : 'Agregar'}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm}
              className="px-4 py-2 rounded-md text-sm"
              style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
            >
              Cancelar
            </button>
          )}
        </div>
      </form>

      <div className="space-y-2">
        {courts.map(court => (
          <div
            key={court.id}
            className="flex items-center justify-between px-4 py-3 rounded-md"
            style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
          >
            <div>
              <span className="font-medium" style={{ color: 'var(--color-text)' }}>{court.name}</span>
              {court.mapsUrl && (
                <a
                  href={court.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 text-xs underline"
                  style={{ color: 'var(--color-primary)' }}
                >
                  Ver mapa
                </a>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleEdit(court)} className="text-xs px-2 py-1 rounded" style={{ color: 'var(--color-primary)' }}>Editar</button>
              <button onClick={() => handleDelete(court.id)} className="text-xs px-2 py-1 rounded" style={{ color: 'var(--color-danger)' }}>Eliminar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
