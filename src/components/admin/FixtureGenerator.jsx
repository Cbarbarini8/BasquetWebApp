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
    const last = teams.pop();
    teams.splice(1, 0, last);
  }

  return rounds;
}

export default function FixtureGenerator({ teams, matches, activeSeason }) {
  const [loading, setLoading] = useState(false);

  const hasMatches = matches.length > 0;

  const handleGenerate = async () => {
    if (!activeSeason) {
      alert('Crea una temporada primero desde la pestaña "Temporadas"');
      return;
    }
    if (teams.length < 2) {
      alert('Se necesitan al menos 2 equipos');
      return;
    }

    setLoading(true);
    try {
      const teamIds = teams.map(t => t.id);
      const rounds = generateRoundRobin(teamIds);

      for (let i = 0; i < rounds.length; i++) {
        for (const match of rounds[i]) {
          await addDoc(collection(db, 'matches'), {
            round: i + 1,
            homeTeamId: match.homeTeamId,
            awayTeamId: match.awayTeamId,
            homeScore: 0,
            awayScore: 0,
            status: 'scheduled',
            scheduledDate: null,
            scheduledTime: '',
            quarter: 0,
            seasonId: activeSeason.id,
            createdAt: serverTimestamp(),
            startedAt: null,
            finishedAt: null,
          });
        }
      }

      alert(`Fixture generado: ${rounds.length} fechas para "${activeSeason.name}". Asigna dia y horario a cada partido desde la pestaña "Partidos".`);
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

      {activeSeason && (
        <p className="text-xs mb-2 font-medium" style={{ color: 'var(--color-primary)' }}>
          Temporada: {activeSeason.name}
        </p>
      )}

      <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
        Genera automaticamente los cruces (todos contra todos) con {teams.length} equipos
        {teams.length >= 2 && (
          <> ({teams.length % 2 === 0 ? teams.length - 1 : teams.length} fechas)</>
        )}.
        Los dias y horarios se asignan despues desde la pestaña "Partidos".
      </p>

      {!activeSeason && (
        <p className="text-xs mb-3 px-3 py-2 rounded-md" style={{ backgroundColor: 'var(--color-bg-hover)', color: 'var(--color-warning)' }}>
          Crea una temporada primero desde la pestaña "Temporadas".
        </p>
      )}

      {hasMatches && (
        <p className="text-xs mb-3 px-3 py-2 rounded-md" style={{ backgroundColor: 'var(--color-bg-hover)', color: 'var(--color-text-muted)' }}>
          Ya hay un fixture cargado ({matches.length} partidos) para esta temporada. Esta funcion estara disponible cuando se necesite generar uno nuevo.
        </p>
      )}

      <button
        onClick={handleGenerate}
        disabled={loading || teams.length < 2 || hasMatches || !activeSeason}
        className="px-4 py-2 rounded-md text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ backgroundColor: 'var(--color-btn-primary)' }}
      >
        {loading ? 'Generando...' : 'Generar Fixture'}
      </button>
    </div>
  );
}
