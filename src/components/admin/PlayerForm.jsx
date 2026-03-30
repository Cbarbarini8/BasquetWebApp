import { useState } from 'react';
import { collection, addDoc, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export default function PlayerForm({ players, teams }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [number, setNumber] = useState('');
  const [teamId, setTeamId] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [filterTeam, setFilterTeam] = useState('');

  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setNumber('');
    setTeamId('');
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !teamId) return;

    const data = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      number: parseInt(number) || 0,
      teamId,
    };

    if (editingId) {
      await updateDoc(doc(db, 'players', editingId), data);
    } else {
      await addDoc(collection(db, 'players'), { ...data, active: true, createdAt: serverTimestamp() });
    }
    resetForm();
  };

  const handleEdit = (player) => {
    setFirstName(player.firstName);
    setLastName(player.lastName);
    setNumber(String(player.number || ''));
    setTeamId(player.teamId);
    setEditingId(player.id);
  };

  const handleDelete = async (playerId) => {
    if (window.confirm('Eliminar este jugador?')) {
      await deleteDoc(doc(db, 'players', playerId));
    }
  };

  const teamMap = {};
  teams.forEach(t => { teamMap[t.id] = t.name; });

  const filteredPlayers = filterTeam
    ? players.filter(p => p.teamId === filterTeam)
    : players;

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 mb-4">
        <input
          type="text"
          placeholder="Nombre"
          value={firstName}
          onChange={e => setFirstName(e.target.value)}
          required
          className="flex-1 min-w-[120px] px-3 py-2 rounded-md text-sm"
          style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
        />
        <input
          type="text"
          placeholder="Apellido"
          value={lastName}
          onChange={e => setLastName(e.target.value)}
          required
          className="flex-1 min-w-[120px] px-3 py-2 rounded-md text-sm"
          style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
        />
        <input
          type="number"
          placeholder="#"
          value={number}
          onChange={e => setNumber(e.target.value)}
          className="w-16 px-3 py-2 rounded-md text-sm"
          style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
        />
        <select
          value={teamId}
          onChange={e => setTeamId(e.target.value)}
          required
          className="px-3 py-2 rounded-md text-sm"
          style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
        >
          <option value="">Equipo...</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
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
      </form>

      <div className="mb-3">
        <select
          value={filterTeam}
          onChange={e => setFilterTeam(e.target.value)}
          className="px-3 py-2 rounded-md text-sm"
          style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
        >
          <option value="">Todos los equipos</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        {filteredPlayers.map(player => (
          <div
            key={player.id}
            className="flex items-center justify-between px-4 py-3 rounded-md"
            style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
          >
            <div>
              <span className="font-medium" style={{ color: 'var(--color-text)' }}>
                #{player.number} {player.firstName} {player.lastName}
              </span>
              <span className="ml-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {teamMap[player.teamId] || ''}
              </span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleEdit(player)} className="text-xs px-2 py-1" style={{ color: 'var(--color-primary)' }}>Editar</button>
              <button onClick={() => handleDelete(player.id)} className="text-xs px-2 py-1" style={{ color: 'var(--color-danger)' }}>Eliminar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
