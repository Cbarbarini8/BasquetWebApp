import { useState } from 'react';
import { collection, addDoc, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import TeamLogo from '../common/TeamLogo';

function normalizeDriveUrl(url) {
  if (!url) return '';
  // https://drive.google.com/file/d/ARCHIVO_ID/view?...
  const match = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (match) {
    return `https://lh3.googleusercontent.com/d/${match[1]}`;
  }
  // https://drive.google.com/open?id=ARCHIVO_ID
  const match2 = url.match(/drive\.google\.com\/open\?id=([^&]+)/);
  if (match2) {
    return `https://lh3.googleusercontent.com/d/${match2[1]}`;
  }
  return url;
}

export default function TeamForm({ teams }) {
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [editingId, setEditingId] = useState(null);

  const resetForm = () => {
    setName('');
    setShortName('');
    setLogoUrl('');
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    const data = {
      name: name.trim(),
      shortName: shortName.trim().toUpperCase() || name.trim().substring(0, 3).toUpperCase(),
      logoUrl: normalizeDriveUrl(logoUrl.trim()),
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
    setLogoUrl(team.logoUrl || '');
    setEditingId(team.id);
  };

  const handleDelete = async (teamId) => {
    if (window.confirm('Eliminar este equipo?')) {
      await deleteDoc(doc(db, 'teams', teamId));
    }
  };

  const previewUrl = normalizeDriveUrl(logoUrl.trim());

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-3 mb-6">
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Nombre del equipo"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            className="flex-1 min-w-[200px] px-3 py-2 rounded-md text-sm"
            style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
          />
          <input
            type="text"
            placeholder="Abrev. (ej: HAL)"
            value={shortName}
            onChange={e => setShortName(e.target.value)}
            maxLength={4}
            className="w-28 px-3 py-2 rounded-md text-sm"
            style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
          />
        </div>

        <div className="flex items-center gap-3">
          {previewUrl && <TeamLogo url={previewUrl} name={name} size={40} />}
          <input
            type="url"
            placeholder="URL del logo (Google Drive, imgur, etc.)"
            value={logoUrl}
            onChange={e => setLogoUrl(e.target.value)}
            className="flex-1 px-3 py-2 rounded-md text-sm"
            style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
          />
        </div>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Podes pegar un link de Google Drive y se convierte automaticamente.
        </p>

        <div className="flex gap-2">
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
        </div>
      </form>

      <div className="space-y-2">
        {teams.map(team => (
          <div
            key={team.id}
            className="flex items-center justify-between px-4 py-3 rounded-md"
            style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
          >
            <div className="flex items-center gap-3">
              <TeamLogo url={team.logoUrl} name={team.name} size={36} />
              <div>
                <span className="font-medium" style={{ color: 'var(--color-text)' }}>{team.name}</span>
                <span className="ml-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>{team.shortName}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleEdit(team)} className="text-xs px-2 py-1 rounded" style={{ color: 'var(--color-primary)' }}>Editar</button>
              <button onClick={() => handleDelete(team.id)} className="text-xs px-2 py-1 rounded" style={{ color: 'var(--color-danger)' }}>Eliminar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
