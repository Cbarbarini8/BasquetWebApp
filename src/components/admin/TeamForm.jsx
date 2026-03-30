import { useState, useRef } from 'react';
import { collection, addDoc, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { uploadToCloudinary } from '../../lib/cloudinary';
import TeamLogo from '../common/TeamLogo';

export default function TeamForm({ teams }) {
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const resetForm = () => {
    setName('');
    setShortName('');
    setLogoFile(null);
    setLogoPreview('');
    setEditingId(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setLogoFile(f);
    setLogoPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setUploading(true);

    try {
      let logoUrl;
      if (logoFile) {
        logoUrl = await uploadToCloudinary(logoFile, 'teams');
      }

      const data = {
        name: name.trim(),
        shortName: shortName.trim().toUpperCase() || name.trim().substring(0, 3).toUpperCase(),
      };

      if (editingId) {
        if (logoUrl) data.logoUrl = logoUrl;
        await updateDoc(doc(db, 'teams', editingId), data);
      } else {
        data.logoUrl = logoUrl || '';
        await addDoc(collection(db, 'teams'), { ...data, createdAt: serverTimestamp() });
      }
      resetForm();
    } catch (err) {
      console.error(err);
      alert('Error al guardar equipo');
    } finally {
      setUploading(false);
    }
  };

  const handleEdit = (team) => {
    setName(team.name);
    setShortName(team.shortName || '');
    setLogoFile(null);
    setLogoPreview(team.logoUrl || '');
    setEditingId(team.id);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleDelete = async (teamId) => {
    if (window.confirm('Eliminar este equipo?')) {
      await deleteDoc(doc(db, 'teams', teamId));
    }
  };

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
          {logoPreview && <TeamLogo url={logoPreview} name={name} size={40} />}
          <label
            className="px-3 py-1.5 rounded-md text-sm font-medium cursor-pointer"
            style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
          >
            {logoPreview ? 'Cambiar logo' : 'Subir logo'}
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
          </label>
          {logoPreview && (
            <button type="button"
              onClick={() => { setLogoFile(null); setLogoPreview(''); if (fileRef.current) fileRef.current.value = ''; }}
              className="text-xs" style={{ color: 'var(--color-danger)' }}>
              Quitar
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={uploading}
            className="px-4 py-2 rounded-md text-white text-sm font-medium disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-btn-primary)' }}
          >
            {uploading ? 'Subiendo...' : editingId ? 'Actualizar' : 'Agregar'}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm}
              className="px-4 py-2 rounded-md text-sm font-medium"
              style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
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
              <button onClick={() => handleEdit(team)} className="text-xs px-2 py-1 rounded cursor-pointer font-medium"
                style={{ color: 'var(--color-primary)', border: '1px solid var(--color-primary)' }}>Editar</button>
              <button onClick={() => handleDelete(team.id)} className="text-xs px-2 py-1 rounded cursor-pointer font-medium"
                style={{ color: 'var(--color-danger)', border: '1px solid var(--color-danger)' }}>Eliminar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
