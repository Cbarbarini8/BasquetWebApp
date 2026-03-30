import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';

function generateRoundRobin(teamIds) {
  const teams = [...teamIds];
  if (teams.length % 2 !== 0) {
    teams.push(null); // BYE
  }

  const n = teams.length;
  const rounds = [];

  for (let round = 0; round < n - 1; round++) {
    const matches = [];
    for (let i = 0; i < n / 2; i++) {
      const home = teams[i];
      const away = teams[n - 1 - i];
      if (home && away) {
        matches.push({ homeTeamId: home, awayTeamId: away });
      }
    }
    rounds.push(matches);
    // Rotate: fix first team, rotate the rest
    const last = teams.pop();
    teams.splice(1, 0, last);
  }

  return rounds;
}

export default function FixtureGenerator({ teams, matches }) {
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [defaultTime, setDefaultTime] = useState('20:00');

  const hasMatches = matches.length > 0;

  const handleGenerate = async () => {
    if (teams.length < 2) {
      alert('Se necesitan al menos 2 equipos');
      return;
    }
    if (hasMatches) {
      if (!window.confirm('Ya hay partidos cargados. Esto generara nuevos partidos sin eliminar los existentes. Continuar?')) {
        return;
      }
    }

    setLoading(true);
    try {
      const teamIds = teams.map(t => t.id);
      const rounds = generateRoundRobin(teamIds);

      const baseDate = startDate ? new Date(startDate + 'T00:00:00') : new Date();

      for (let i = 0; i < rounds.length; i++) {
        const roundDate = new Date(baseDate);
        roundDate.setDate(roundDate.getDate() + i * 7); // una fecha por semana

        for (const match of rounds[i]) {
          await addDoc(collection(db, 'matches'), {
            round: i + 1,
            homeTeamId: match.homeTeamId,
            awayTeamId: match.awayTeamId,
            homeScore: 0,
            awayScore: 0,
            status: 'scheduled',
            scheduledDate: roundDate,
            scheduledTime: defaultTime,
            quarter: 0,
            createdAt: serverTimestamp(),
            startedAt: null,
            finishedAt: null,
          });
        }
      }

      alert(`Fixture generado: ${rounds.length} fechas`);
    } catch (err) {
      console.error('Error generating fixture:', err);
      alert('Error al generar el fixture');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="p-4 rounded-lg"
      style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
    >
      <h3 className="font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
        Generar Fixture Round-Robin
      </h3>
      <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
        Genera automaticamente todos contra todos con {teams.length} equipos
        ({teams.length % 2 === 0 ? teams.length - 1 : teams.length} fechas).
      </p>

      <div className="flex flex-wrap gap-3 mb-4">
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Fecha inicio</label>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="px-3 py-2 rounded-md text-sm"
            style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
          />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Horario default</label>
          <input
            type="time"
            value={defaultTime}
            onChange={e => setDefaultTime(e.target.value)}
            className="px-3 py-2 rounded-md text-sm"
            style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
          />
        </div>
      </div>

      <button
        onClick={handleGenerate}
        disabled={loading || teams.length < 2}
        className="px-4 py-2 rounded-md text-white text-sm font-medium disabled:opacity-50"
        style={{ backgroundColor: 'var(--color-btn-primary)' }}
      >
        {loading ? 'Generando...' : 'Generar Fixture'}
      </button>
    </div>
  );
}
