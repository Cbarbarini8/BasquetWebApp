import { useState } from 'react';
import { collection, addDoc, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { logAction } from '../../lib/audit';
import { IconButton, EditIcon, DeleteIcon } from '../common/Icons';

export default function CourtForm({ courts, canEdit, user }) {
  const [name, setName] = useState('');
  const [mapsUrl, setMapsUrl] = useState('');
  const [editingId, setEditingId] = useState(null);

  const resetForm = () => { setName(''); setMapsUrl(''); setEditingId(null); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    const data = { name: name.trim(), mapsUrl: mapsUrl.trim() };

    if (editingId) {
      await updateDoc(doc(db, 'courts', editingId), data);
      await logAction(user, 'update', 'courts', editingId, `Edito cancha: ${data.name}`);
    } else {
      const ref = await addDoc(collection(db, 'courts'), { ...data, createdAt: serverTimestamp() });
      await logAction(user, 'create', 'courts', ref.id, `Creo cancha: ${data.name}`);
    }
    resetForm();
  };

  const handleEdit = (court) => { setName(court.name); setMapsUrl(court.mapsUrl || ''); setEditingId(court.id); };

  const handleDelete = async (court) => {
    if (window.confirm('Eliminar esta cancha?')) {
      await deleteDoc(doc(db, 'courts', court.id));
      await logAction(user, 'delete', 'courts', court.id, `Elimino cancha: ${court.name}`);
    }
  };

  const inputStyle = { backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text)' };

  return (
    <div>
      {canEdit && (
        <form onSubmit={handleSubmit} className="space-y-3 mb-6">
          <input type="text" placeholder="Nombre de la cancha" value={name} onChange={e => setName(e.target.value)} required
            className="w-full px-3 py-2 rounded-md text-sm" style={inputStyle} />
          <input type="url" placeholder="Link de Google Maps (opcional)" value={mapsUrl} onChange={e => setMapsUrl(e.target.value)}
            className="w-full px-3 py-2 rounded-md text-sm" style={inputStyle} />
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 rounded-md text-white text-sm font-medium" style={{ backgroundColor: 'var(--color-btn-primary)' }}>
              {editingId ? 'Actualizar' : 'Agregar'}
            </button>
            {editingId && <button type="button" onClick={resetForm} className="px-4 py-2 rounded-md text-sm"
              style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>Cancelar</button>}
          </div>
        </form>
      )}
      <div className="space-y-2">
        {courts.map(court => (
          <div key={court.id} className="flex items-center justify-between px-4 py-3 rounded-md" style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
            <div>
              <span className="font-medium" style={{ color: 'var(--color-text)' }}>{court.name}</span>
              {court.mapsUrl && <a href={court.mapsUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-xs underline" style={{ color: 'var(--color-primary)' }}>Ver mapa</a>}
            </div>
            {canEdit && (
              <div className="flex gap-1">
                <IconButton icon={EditIcon} label="Editar" onClick={() => handleEdit(court)} />
                <IconButton icon={DeleteIcon} label="Eliminar" onClick={() => handleDelete(court)} color="var(--color-danger)" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
