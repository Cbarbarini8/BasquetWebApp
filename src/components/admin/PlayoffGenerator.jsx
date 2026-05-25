import { useState, useMemo } from 'react';
import { db } from '../../lib/firebase';
import { logAction } from '../../lib/audit';
import { useToast } from '../../context/ToastContext';
import {
  PLAYOFF_TEAM_COUNT,
  canGeneratePlayoffs,
  computePlayoffSeeds,
  generatePlayoffsForSeason,
  PLAYOFF_TEMPLATE,
} from '../../lib/playoffs';
import { computeStandings } from '../../lib/calculations';

export default function PlayoffGenerator({ teams, matches, activeSeason, canEdit, user }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const playoffMatches = useMemo(
    () => (matches || []).filter(m => m.bracketSlot && m.seasonId === activeSeason?.id),
    [matches, activeSeason],
  );
  const hasPlayoff = playoffMatches.length > 0;

  const standings = useMemo(() => {
    const regular = (matches || []).filter(m => !m.phase || m.phase === 'regular');
    return computeStandings(regular, teams || []);
  }, [matches, teams]);

  const validity = useMemo(
    () => canGeneratePlayoffs(standings, matches || []),
    [standings, matches],
  );

  const seedsPreview = useMemo(() => {
    if (!validity.ok) return [];
    const teamsMap = Object.fromEntries((teams || []).map(t => [t.id, t]));
    return standings.slice(0, PLAYOFF_TEAM_COUNT).map((s, i) => ({
      position: i + 1,
      teamId: s.teamId,
      teamName: teamsMap[s.teamId]?.name || s.teamId,
      points: s.points,
      diff: s.diff,
    }));
  }, [validity, standings, teams]);

  const handleGenerate = async () => {
    if (!activeSeason) return;
    if (!validity.ok) {
      toast.warning(validity.reason);
      return;
    }
    setLoading(true);
    try {
      const seeds = computePlayoffSeeds(matches, teams);
      const created = await generatePlayoffsForSeason(db, {
        seasonId: activeSeason.id,
        seeds,
        existingMatches: matches,
      });
      await logAction(
        user,
        'generate-playoffs',
        'matches',
        activeSeason.id,
        `Genero playoffs (${created.length} partidos) para "${activeSeason.name}"`,
      );
      toast.success(`Playoffs generados: ${created.length} partidos. Asigna fechas desde "Partidos".`, 6000);
      setConfirmOpen(false);
    } catch (err) {
      console.error('Error generando playoffs:', err);
      toast.error(err.message || 'Error al generar los playoffs');
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
        Generar Playoffs (Apertura 2026)
      </h3>

      {activeSeason && (
        <p className="text-xs mb-2 font-medium" style={{ color: 'var(--color-primary)' }}>
          Temporada: {activeSeason.name}
        </p>
      )}

      <p className="text-sm mb-3" style={{ color: 'var(--color-text-secondary)' }}>
        Crea los {PLAYOFF_TEMPLATE.length} partidos del bracket (play-in, cuartos, semis y final) usando la tabla
        general actual como seeding. Los equipos que dependen de rondas previas se completan automaticamente
        cuando esos partidos terminan.
      </p>

      {hasPlayoff && (
        <div
          className="text-xs mb-3 px-3 py-2 rounded-md"
          style={{ backgroundColor: 'var(--color-bg-hover)', color: 'var(--color-text-muted)' }}
        >
          Ya hay un bracket cargado ({playoffMatches.length}/{PLAYOFF_TEMPLATE.length} partidos) para esta temporada.
        </div>
      )}

      {!hasPlayoff && !validity.ok && (
        <div
          className="text-xs mb-3 px-3 py-2 rounded-md"
          style={{ backgroundColor: 'var(--color-bg-hover)', color: 'var(--color-warning)' }}
        >
          {validity.reason}
        </div>
      )}

      {!hasPlayoff && validity.ok && (
        <>
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={loading || !canEdit}
            className="px-4 py-2 rounded-md text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--color-btn-primary)' }}
          >
            {loading ? 'Generando...' : 'Generar Playoffs'}
          </button>
        </>
      )}

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          onClick={() => !loading && setConfirmOpen(false)}
        >
          <div
            className="rounded-lg p-4 w-full max-w-md max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-bold mb-2" style={{ color: 'var(--color-text)' }}>
              Confirmar seeding del bracket
            </h3>
            <p className="text-xs mb-3" style={{ color: 'var(--color-text-secondary)' }}>
              Estos son los {PLAYOFF_TEAM_COUNT} equipos que entran al playoff segun la tabla general actual.
              El bracket queda fijado a este orden — si editas un partido regular despues, los seeds NO se recalculan.
            </p>
            <ol className="space-y-1 mb-4">
              {seedsPreview.map(s => (
                <li
                  key={s.teamId}
                  className="flex items-center justify-between px-2 py-1.5 rounded text-sm"
                  style={{ backgroundColor: 'var(--color-bg-card)' }}
                >
                  <span style={{ color: 'var(--color-text)' }}>
                    <strong>{s.position}°</strong> {s.teamName}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {s.points} pts ({s.diff >= 0 ? '+' : ''}{s.diff})
                  </span>
                </li>
              ))}
            </ol>
            <div className="flex gap-2 justify-end" style={{ borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={loading}
                className="px-3 py-1.5 rounded text-sm"
                style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading || !canEdit}
                className="px-4 py-1.5 rounded text-sm text-white font-medium disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-btn-primary)' }}
              >
                {loading ? 'Generando...' : 'Confirmar y generar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
