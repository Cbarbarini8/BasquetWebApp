import { doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../../lib/firebase';

export default function MatchManager({ matches, teamsMap }) {
  const navigate = useNavigate();

  const startMatch = async (matchId) => {
    await updateDoc(doc(db, 'matches', matchId), {
      status: 'live',
      quarter: 1,
      homeScore: 0,
      awayScore: 0,
      startedAt: serverTimestamp(),
    });
  };

  const finishMatch = async (matchId) => {
    if (!window.confirm('Finalizar este partido?')) return;
    await updateDoc(doc(db, 'matches', matchId), {
      status: 'finished',
      finishedAt: serverTimestamp(),
    });
  };

  const resetMatch = async (matchId) => {
    if (!window.confirm('Resetear este partido a programado?')) return;
    await updateDoc(doc(db, 'matches', matchId), {
      status: 'scheduled',
      homeScore: 0,
      awayScore: 0,
      quarter: 0,
      startedAt: null,
      finishedAt: null,
    });
  };

  const deleteMatch = async (matchId) => {
    if (!window.confirm('Eliminar este partido?')) return;
    await deleteDoc(doc(db, 'matches', matchId));
  };

  const groupedByRound = {};
  matches.forEach(m => {
    const r = m.round || 1;
    if (!groupedByRound[r]) groupedByRound[r] = [];
    groupedByRound[r].push(m);
  });

  const roundNumbers = Object.keys(groupedByRound).map(Number).sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      {roundNumbers.map(round => (
        <div key={round}>
          <h3 className="text-sm font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--color-primary)' }}>
            Fecha {round}
          </h3>
          <div className="space-y-2">
            {groupedByRound[round].map(match => {
              const home = teamsMap[match.homeTeamId]?.name || 'TBD';
              const away = teamsMap[match.awayTeamId]?.name || 'TBD';

              return (
                <div
                  key={match.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 rounded-md"
                  style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>
                      {home} vs {away}
                    </span>
                    {match.status === 'live' && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: 'var(--color-live)' }}>
                        EN VIVO {match.homeScore}-{match.awayScore}
                      </span>
                    )}
                    {match.status === 'finished' && (
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        Final: {match.homeScore}-{match.awayScore}
                      </span>
                    )}
                    {match.status === 'scheduled' && (
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {match.scheduledTime || 'Programado'}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {match.status === 'scheduled' && (
                      <button onClick={() => startMatch(match.id)} className="text-xs px-3 py-1 rounded text-white font-medium" style={{ backgroundColor: 'var(--color-success)' }}>
                        Iniciar
                      </button>
                    )}
                    {match.status === 'live' && (
                      <>
                        <button onClick={() => navigate(`/admin/match/${match.id}`)} className="text-xs px-3 py-1 rounded text-white font-medium" style={{ backgroundColor: 'var(--color-primary)' }}>
                          Planilla
                        </button>
                        <button onClick={() => finishMatch(match.id)} className="text-xs px-3 py-1 rounded text-white font-medium" style={{ backgroundColor: 'var(--color-warning)' }}>
                          Finalizar
                        </button>
                      </>
                    )}
                    <button onClick={() => resetMatch(match.id)} className="text-xs px-2 py-1 rounded" style={{ color: 'var(--color-text-muted)' }}>
                      Reset
                    </button>
                    <button onClick={() => deleteMatch(match.id)} className="text-xs px-2 py-1 rounded" style={{ color: 'var(--color-danger)' }}>
                      Eliminar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
