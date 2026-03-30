import { useState, useRef } from 'react';
import { collection, addDoc, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { generateToken } from '../../lib/utils';
import { uploadToCloudinary } from '../../lib/cloudinary';

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

export default function PlayerForm({ players, teams }) {
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
      let photoUrl = '';
      if (photoFile) {
        photoUrl = await uploadToCloudinary(photoFile, 'players');
      }

      const data = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        number: parseInt(number) || 0,
        teamId,
      };

      if (editingId) {
        if (photoUrl) data.photoUrl = photoUrl;
        await updateDoc(doc(db, 'players', editingId), data);
      } else {
        const token = generateToken();
        await addDoc(collection(db, 'players'), {
          ...data,
          photoUrl,
          photoStatus: photoUrl ? 'approved' : 'none',
          uploadToken: token,
          active: true,
          createdAt: serverTimestamp(),
        });
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

  const handleDelete = async (playerId) => {
    if (window.confirm('Eliminar este jugador?')) {
      await deleteDoc(doc(db, 'players', playerId));
    }
  };

  const handleApprove = async (player) => {
    await updateDoc(doc(db, 'players', player.id), {
      photoUrl: player.pendingPhotoUrl,
      pendingPhotoUrl: null,
      photoStatus: 'approved',
    });
  };

  const handleReject = async (player) => {
    await updateDoc(doc(db, 'players', player.id), {
      pendingPhotoUrl: null,
      photoStatus: player.photoUrl ? 'approved' : 'none',
    });
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
                    <button
                      onClick={() => handleApprove(player)}
                      className="text-xs px-3 py-1 rounded cursor-pointer font-medium text-white"
                      style={{ backgroundColor: 'var(--color-success)' }}
                    >
                      Aprobar
                    </button>
                    <button
                      onClick={() => handleReject(player)}
                      className="text-xs px-3 py-1 rounded cursor-pointer font-medium"
                      style={{ color: 'var(--color-danger)', border: '1px solid var(--color-danger)' }}
                    >
                      Rechazar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add/edit form */}
      <form onSubmit={handleSubmit} className="space-y-3 mb-6">
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
      </form>

      {/* Filter */}
      <div className="mb-3">
        <select value={filterTeam} onChange={e => setFilterTeam(e.target.value)}
          className="px-3 py-2 rounded-md text-sm" style={inputStyle}>
          <option value="">Todos los equipos</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
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
            <div className="flex gap-1 flex-wrap">
              <button
                onClick={() => generateUploadLink(player)}
                className="text-xs px-2 py-1 rounded cursor-pointer font-medium"
                style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
                title="Copiar link de carga de foto"
              >
                {copiedId === player.id ? 'Copiado!' : 'Link foto'}
              </button>
              <button onClick={() => handleEdit(player)} className="text-xs px-2 py-1 rounded cursor-pointer font-medium"
                style={{ color: 'var(--color-primary)', border: '1px solid var(--color-primary)' }}>Editar</button>
              <button onClick={() => handleDelete(player.id)} className="text-xs px-2 py-1 rounded cursor-pointer font-medium"
                style={{ color: 'var(--color-danger)', border: '1px solid var(--color-danger)' }}>Eliminar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
