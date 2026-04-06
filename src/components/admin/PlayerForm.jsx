import { useState, useRef } from 'react';
import { collection, addDoc, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { generateToken } from '../../lib/utils';
import { uploadToCloudinary } from '../../lib/cloudinary';
import { logAction } from '../../lib/audit';
import { IconButton, EditIcon, DeleteIcon, LinkIcon, CheckIcon, XIcon, ImageIcon } from '../common/Icons';

function PlayerPhoto({ url, name, size = 36 }) {
  if (!url) {
    return (
      <div
        className="rounded-full flex items-center justify-center font-bold text-white shrink-0"
        style={{ width: size, height: size, backgroundColor: 'var(--color-text-muted)', fontSize: size * 0.35 }}
      >
        {(name || '?').charAt(0).toUpperCase()}
      </div>
    );
  }
  return <img src={url} alt={name} className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />;
}

export default function PlayerForm({ players, teams, canEdit, user }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [number, setNumber] = useState('');
  const [teamId, setTeamId] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [filterTeam, setFilterTeam] = useState('');
  const [showPending, setShowPending] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setNumber('');
    setTeamId('');
    setPhotoFile(null);
    setPhotoPreview('');
    setEditingId(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setPhotoFile(f);
    setPhotoPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !teamId) return;
    setUploading(true);

    try {
      const data = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        number: parseInt(number) || 0,
        teamId,
      };

      if (editingId) {
        if (photoFile) {
          data.photoUrl = await uploadToCloudinary(photoFile, 'players', editingId);
          data.photoStatus = 'approved';
        }
        await updateDoc(doc(db, 'players', editingId), data);
        await logAction(user, 'update', 'players', editingId, `Edito jugador: ${data.firstName} ${data.lastName}`);
      } else {
        const token = generateToken();
        const ref = await addDoc(collection(db, 'players'), {
          ...data,
          photoUrl: '',
          photoStatus: 'none',
          uploadToken: token,
          active: true,
          createdAt: serverTimestamp(),
        });
        if (photoFile) {
          const photoUrl = await uploadToCloudinary(photoFile, 'players', ref.id);
          await updateDoc(doc(db, 'players', ref.id), { photoUrl, photoStatus: 'approved' });
        }
        await logAction(user, 'create', 'players', ref.id, `Creo jugador: ${data.firstName} ${data.lastName}`);
      }
      resetForm();
    } catch (err) {
      console.error(err);
      alert('Error al guardar jugador');
    } finally {
      setUploading(false);
    }
  };

  const handleEdit = (player) => {
    setFirstName(player.firstName);
    setLastName(player.lastName);
    setNumber(String(player.number || ''));
    setTeamId(player.teamId);
    setPhotoFile(null);
    setPhotoPreview(player.photoUrl || '');
    setEditingId(player.id);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleClearPhoto = async (player) => {
    if (!window.confirm(`Quitar la foto de ${player.firstName} ${player.lastName}?`)) return;
    await updateDoc(doc(db, 'players', player.id), { photoUrl: '', photoStatus: 'none' });
    await logAction(user, 'update', 'players', player.id, `Quito foto de: ${player.firstName} ${player.lastName}`);
  };

  const handleDelete = async (player) => {
    if (window.confirm('Eliminar este jugador?')) {
      await deleteDoc(doc(db, 'players', player.id));
      await logAction(user, 'delete', 'players', player.id, `Elimino jugador: ${player.firstName} ${player.lastName}`);
    }
  };

  const handleApprove = async (player) => {
    await updateDoc(doc(db, 'players', player.id), {
      photoUrl: player.pendingPhotoUrl,
      pendingPhotoUrl: null,
      photoStatus: 'approved',
    });
    await logAction(user, 'approve', 'players', player.id, `Aprobo foto de: ${player.firstName} ${player.lastName}`);
  };

  const handleReject = async (player) => {
    await updateDoc(doc(db, 'players', player.id), {
      pendingPhotoUrl: null,
      photoStatus: player.photoUrl ? 'approved' : 'none',
    });
    await logAction(user, 'reject', 'players', player.id, `Rechazo foto de: ${player.firstName} ${player.lastName}`);
  };

  const generateUploadLink = async (player) => {
    let token = player.uploadToken;
    if (!token) {
      token = generateToken();
      await updateDoc(doc(db, 'players', player.id), { uploadToken: token });
    }
    const url = `${window.location.origin}/jugador/foto/${token}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(player.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const teamMap = {};
  teams.forEach(t => { teamMap[t.id] = t.name; });

  const pendingPlayers = players.filter(p => p.photoStatus === 'pending');
  const filteredPlayers = filterTeam
    ? players.filter(p => p.teamId === filterTeam)
    : players;

  const inputStyle = { backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text)' };

  return (
    <div>
      {/* Pending approvals */}
      {pendingPlayers.length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => setShowPending(!showPending)}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium mb-2"
            style={{ backgroundColor: 'var(--color-warning)', color: '#ffffff' }}
          >
            Fotos pendientes ({pendingPlayers.length})
            <span>{showPending ? '\u25B2' : '\u25BC'}</span>
          </button>
          {showPending && (
            <div className="space-y-2">
              {pendingPlayers.map(player => (
                <div
                  key={player.id}
                  className="flex items-center justify-between px-4 py-3 rounded-md"
                  style={{ backgroundColor: 'var(--color-bg-card)', border: '2px solid var(--color-warning)' }}
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={player.pendingPhotoUrl}
                      alt="Pendiente"
                      className="w-12 h-12 rounded-full object-cover"
                    />
                    <div>
                      <span className="font-medium" style={{ color: 'var(--color-text)' }}>
                        #{player.number} {player.firstName} {player.lastName}
                      </span>
                      <span className="ml-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {teamMap[player.teamId]}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <IconButton icon={CheckIcon} label="Aprobar" onClick={() => handleApprove(player)} color="var(--color-success)" />
                    <IconButton icon={XIcon} label="Rechazar" onClick={() => handleReject(player)} color="var(--color-danger)" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add/edit form */}
      {canEdit && <form onSubmit={handleSubmit} className="space-y-3 mb-6">
        <div className="flex flex-wrap gap-2">
          <input type="text" placeholder="Nombre" value={firstName} onChange={e => setFirstName(e.target.value)} required
            className="flex-1 min-w-[120px] px-3 py-2 rounded-md text-sm" style={inputStyle} />
          <input type="text" placeholder="Apellido" value={lastName} onChange={e => setLastName(e.target.value)} required
            className="flex-1 min-w-[120px] px-3 py-2 rounded-md text-sm" style={inputStyle} />
          <input type="number" placeholder="#" value={number} onChange={e => setNumber(e.target.value)}
            className="w-16 px-3 py-2 rounded-md text-sm" style={inputStyle} />
          <select value={teamId} onChange={e => setTeamId(e.target.value)} required
            className="px-3 py-2 rounded-md text-sm" style={inputStyle}>
            <option value="">Equipo...</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-3">
          {photoPreview && <PlayerPhoto url={photoPreview} name={firstName} size={40} />}
          <label className="px-3 py-1.5 rounded-md text-sm font-medium cursor-pointer"
            style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
            {photoPreview ? 'Cambiar foto' : 'Subir foto'}
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
          </label>
          {photoPreview && (
            <button type="button" onClick={() => { setPhotoFile(null); setPhotoPreview(''); if (fileRef.current) fileRef.current.value = ''; }}
              className="text-xs" style={{ color: 'var(--color-danger)' }}>Quitar</button>
          )}
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={uploading} className="px-4 py-2 rounded-md text-white text-sm font-medium disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-btn-primary)' }}>
            {uploading ? 'Subiendo...' : editingId ? 'Actualizar' : 'Agregar'}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="px-4 py-2 rounded-md text-sm"
              style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
              Cancelar
            </button>
          )}
        </div>
      </form>}

      {/* Filter + bulk share */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <select value={filterTeam} onChange={e => setFilterTeam(e.target.value)}
          className="px-3 py-2 rounded-md text-sm" style={inputStyle}>
          <option value="">Todos los equipos</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        {canEdit && filteredPlayers.length > 0 && (
          <a
            href={`https://wa.me/?text=${encodeURIComponent(
              `Links para subir foto de jugador:\n\n${filteredPlayers.map(p =>
                `${p.firstName} ${p.lastName}: ${window.location.origin}/jugador/foto/${p.uploadToken}`
              ).join('\n')}`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium text-white"
            style={{ backgroundColor: '#25D366' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Enviar links ({filteredPlayers.length})
          </a>
        )}
      </div>

      {/* Player list */}
      <div className="space-y-2">
        {filteredPlayers.map(player => (
          <div
            key={player.id}
            className="flex items-center justify-between px-4 py-3 rounded-md"
            style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
          >
            <div className="flex items-center gap-3">
              <PlayerPhoto url={player.photoUrl} name={player.firstName} size={36} />
              <div>
                <span className="font-medium" style={{ color: 'var(--color-text)' }}>
                  #{player.number} {player.firstName} {player.lastName}
                </span>
                <span className="ml-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {teamMap[player.teamId] || ''}
                </span>
                {player.photoStatus === 'pending' && (
                  <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: 'var(--color-warning)' }}>
                    Foto pendiente
                  </span>
                )}
              </div>
            </div>
            {canEdit && (
              <div className="flex gap-1 flex-wrap items-center">
                <IconButton icon={LinkIcon} label={copiedId === player.id ? 'Copiado!' : 'Link foto'} onClick={() => generateUploadLink(player)} color="var(--color-text-secondary)" />
                {player.photoUrl && <IconButton icon={ImageIcon} label="Quitar foto" onClick={() => handleClearPhoto(player)} color="var(--color-text-muted)" />}
                <IconButton icon={EditIcon} label="Editar" onClick={() => handleEdit(player)} />
                <IconButton icon={DeleteIcon} label="Eliminar" onClick={() => handleDelete(player)} color="var(--color-danger)" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
