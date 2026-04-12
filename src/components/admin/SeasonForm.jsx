import { useState, useRef } from 'react';
import { collection, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { uploadToCloudinary } from '../../lib/cloudinary';
import { logAction } from '../../lib/audit';
import { IconButton, EditIcon, DeleteIcon, CheckIcon, ImageIcon } from '../common/Icons';
import { useToast } from '../../context/ToastContext';

export default function SeasonForm({ seasons, canEdit, user }) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const resetForm = () => { setName(''); setEditingId(null); setLogoFile(null); setLogoPreview(''); if (fileRef.current) fileRef.current.value = ''; };

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
      if (editingId) {
        const data = { name: name.trim() };
        if (logoFile) {
          data.imageUrl = await uploadToCloudinary(logoFile, 'seasons', editingId);
        }
        await updateDoc(doc(db, 'seasons', editingId), data);
        await logAction(user, 'update', 'seasons', editingId, `Edito temporada: ${name.trim()}`);
      } else {
        const isFirst = seasons.length === 0;
        const ref = await addDoc(collection(db, 'seasons'), { name: name.trim(), active: isFirst, imageUrl: '', createdAt: serverTimestamp() });
        if (logoFile) {
          const imageUrl = await uploadToCloudinary(logoFile, 'seasons', ref.id);
          await updateDoc(doc(db, 'seasons', ref.id), { imageUrl });
        }
        await logAction(user, 'create', 'seasons', ref.id, `Creo temporada: ${name.trim()}`);
      }
      resetForm();
    } catch (err) {
      console.error(err);
      toast.error('Error al guardar temporada');
    } finally {
      setUploading(false);
    }
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

  const handleEdit = (season) => { setName(season.name); setEditingId(season.id); setLogoFile(null); setLogoPreview(season.imageUrl || ''); if (fileRef.current) fileRef.current.value = ''; };

  const handleClearImage = async (season) => {
    if (!window.confirm(`Quitar la imagen de ${season.name}?`)) return;
    await updateDoc(doc(db, 'seasons', season.id), { imageUrl: '' });
    await logAction(user, 'update', 'seasons', season.id, `Quito imagen de temporada: ${season.name}`);
  };

  return (
    <div>
      {canEdit && (
        <form onSubmit={handleSubmit} className="space-y-3 mb-6">
          <div className="flex flex-wrap gap-2">
            <input type="text" placeholder="Nombre (ej: Torneo Apertura 2026)" value={name} onChange={e => setName(e.target.value)} required
              className="flex-1 min-w-[250px] px-3 py-2 rounded-md text-sm"
              style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} />
          </div>

          <div className="flex items-center gap-3">
            {logoPreview && <img src={logoPreview} alt="Preview" className="w-10 h-10 rounded object-cover" />}
            <label
              className="px-3 py-1.5 rounded-md text-sm font-medium cursor-pointer"
              style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
            >
              {logoPreview ? 'Cambiar imagen' : 'Subir imagen'}
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
            <button type="submit" disabled={uploading} className="px-4 py-2 rounded-md text-white text-sm font-medium disabled:opacity-50" style={{ backgroundColor: 'var(--color-btn-primary)' }}>
              {uploading ? 'Subiendo...' : editingId ? 'Actualizar' : 'Crear temporada'}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="px-4 py-2 rounded-md text-sm"
                style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>Cancelar</button>
            )}
          </div>
        </form>
      )}
      <div className="space-y-2">
        {seasons.map(season => (
          <div key={season.id} className="flex items-center justify-between px-4 py-3 rounded-md"
            style={{ backgroundColor: 'var(--color-bg-card)', border: season.active ? '2px solid var(--color-primary)' : '1px solid var(--color-border)' }}>
            <div className="flex items-center gap-3">
              {season.imageUrl && <img src={season.imageUrl} alt={season.name} className="w-9 h-9 rounded object-cover shrink-0" />}
              <span className="font-medium" style={{ color: 'var(--color-text)' }}>{season.name}</span>
              {season.active && <span className="text-xs px-2 py-0.5 rounded-full font-medium text-white" style={{ backgroundColor: 'var(--color-primary)' }}>Activa</span>}
            </div>
            {canEdit && (
              <div className="flex gap-1">
                {!season.active && <IconButton icon={CheckIcon} label="Activar" onClick={() => handleSetActive(season.id)} color="var(--color-success)" />}
                {season.imageUrl && <IconButton icon={ImageIcon} label="Quitar imagen" onClick={() => handleClearImage(season)} color="var(--color-text-muted)" />}
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
