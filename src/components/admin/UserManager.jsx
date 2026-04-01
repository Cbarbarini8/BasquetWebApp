import { useState } from 'react';
import { collection, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useCollection } from '../../hooks/useCollection';
import { logAction } from '../../lib/audit';
import { orderBy } from 'firebase/firestore';
import { IconButton, ShieldIcon, ToggleOnIcon, ToggleOffIcon } from '../common/Icons';

const SECTION_LABELS = {
  seasons: 'Temporadas',
  teams: 'Equipos',
  players: 'Jugadores',
  courts: 'Canchas',
  fixture: 'Fixture',
  matches: 'Partidos',
  scoring: 'Planilla en vivo',
  posts: 'Instagram',
};

const PERM_OPTIONS = [
  { value: '', label: 'Sin acceso' },
  { value: 'view', label: 'Ver' },
  { value: 'edit', label: 'Editar' },
];

export default function UserManager({ currentUser }) {
  const { data: users } = useCollection('users', [orderBy('createdAt', 'desc')]);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [uid, setUid] = useState('');
  const [permissions, setPermissions] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setEmail('');
    setDisplayName('');
    setUid('');
    setPermissions({});
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!uid.trim() || !email.trim()) return;
    setSaving(true);

    try {
      const cleanPerms = {};
      Object.keys(SECTION_LABELS).forEach(key => {
        cleanPerms[key] = permissions[key] || null;
      });

      if (editingId) {
        await updateDoc(doc(db, 'users', editingId), {
          displayName: displayName.trim(),
          permissions: cleanPerms,
        });
        await logAction(currentUser, 'update', 'users', editingId, `Actualizo permisos de ${email}`);
      } else {
        await setDoc(doc(db, 'users', uid.trim()), {
          email: email.trim(),
          displayName: displayName.trim(),
          role: 'admin',
          permissions: cleanPerms,
          active: true,
          createdAt: serverTimestamp(),
        });
        await logAction(currentUser, 'create', 'users', uid.trim(), `Creo usuario admin: ${email}`);
      }
      resetForm();
    } catch (err) {
      console.error(err);
      alert('Error al guardar usuario');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (user) => {
    setUid(user.id);
    setEmail(user.email);
    setDisplayName(user.displayName || '');
    setPermissions(user.permissions || {});
    setEditingId(user.id);
  };

  const toggleActive = async (user) => {
    const newActive = !user.active;
    await updateDoc(doc(db, 'users', user.id), { active: newActive });
    await logAction(currentUser, 'update', 'users', user.id, `${newActive ? 'Activo' : 'Desactivo'} usuario: ${user.email}`);
  };

  const inputStyle = { backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text)' };

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-4 mb-6 p-4 rounded-lg" style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
        <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>
          {editingId ? 'Editar usuario' : 'Agregar usuario'}
        </h3>

        {!editingId && (
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            El usuario debe tener una cuenta creada en Firebase Authentication. Ingresa su UID y email.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {!editingId && (
            <input type="text" placeholder="UID de Firebase Auth" value={uid} onChange={e => setUid(e.target.value)} required
              className="flex-1 min-w-[200px] px-3 py-2 rounded-md text-sm" style={inputStyle} />
          )}
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required disabled={!!editingId}
            className="flex-1 min-w-[200px] px-3 py-2 rounded-md text-sm" style={{ ...inputStyle, opacity: editingId ? 0.6 : 1 }} />
          <input type="text" placeholder="Nombre" value={displayName} onChange={e => setDisplayName(e.target.value)}
            className="flex-1 min-w-[150px] px-3 py-2 rounded-md text-sm" style={inputStyle} />
        </div>

        <div>
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>Permisos por seccion:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {Object.entries(SECTION_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between px-3 py-2 rounded-md" style={{ backgroundColor: 'var(--color-bg-hover)' }}>
                <span className="text-sm" style={{ color: 'var(--color-text)' }}>{label}</span>
                <select
                  value={permissions[key] || ''}
                  onChange={e => setPermissions(p => ({ ...p, [key]: e.target.value || null }))}
                  className="px-2 py-1 rounded text-xs" style={inputStyle}
                >
                  {PERM_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button type="submit" disabled={saving}
            className="px-4 py-2 rounded-md text-white text-sm font-medium disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-btn-primary)' }}>
            {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Agregar'}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="px-4 py-2 rounded-md text-sm"
              style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
              Cancelar
            </button>
          )}
        </div>
      </form>

      <div className="space-y-2">
        {users.map(u => (
          <div key={u.id} className="px-4 py-3 rounded-md"
            style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)', opacity: u.active ? 1 : 0.5 }}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="font-medium" style={{ color: 'var(--color-text)' }}>
                  {u.displayName || u.email}
                </span>
                <span className="ml-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>{u.email}</span>
                <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full text-white"
                  style={{ backgroundColor: u.role === 'owner' ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
                  {u.role === 'owner' ? 'Propietario' : 'Admin'}
                </span>
                {!u.active && (
                  <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: 'var(--color-danger)' }}>
                    Inactivo
                  </span>
                )}
              </div>
              {u.role !== 'owner' && (
                <div className="flex gap-1">
                  <IconButton icon={ShieldIcon} label="Permisos" onClick={() => handleEdit(u)} />
                  <IconButton icon={u.active ? ToggleOffIcon : ToggleOnIcon} label={u.active ? 'Desactivar' : 'Activar'} onClick={() => toggleActive(u)} color={u.active ? 'var(--color-danger)' : 'var(--color-success)'} />
                </div>
              )}
            </div>
            {u.role !== 'owner' && u.permissions && (
              <div className="mt-2 flex flex-wrap gap-1">
                {Object.entries(SECTION_LABELS).map(([key, label]) => {
                  const perm = u.permissions[key];
                  if (!perm) return null;
                  return (
                    <span key={key} className="text-xs px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: 'var(--color-bg-hover)', color: perm === 'edit' ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>
                      {label}: {perm === 'edit' ? 'Editar' : 'Ver'}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
