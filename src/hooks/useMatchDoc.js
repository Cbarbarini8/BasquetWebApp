import { useEffect, useState } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

// Hook para el doc /matches/{id} en pantallas publicas:
// - getDoc inicial siempre.
// - Si status === 'live', sube a onSnapshot para reflejar score/clock/quarter
//   en tiempo real para el espectador.
// - Si status es 'finished' o 'scheduled', no mantiene listener (los datos no
//   cambian, el usuario puede refrescar para ver actualizaciones).
// - Si durante la sesion el partido termina, cerramos el listener: la pagina
//   muestra los datos finales cargados al entrar.
export function useMatchDoc(matchId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!matchId) {
      setData(null);
      setLoading(false);
      return;
    }

    const ref = doc(db, 'matches', matchId);
    let cancelled = false;
    let unsubscribe = null;

    setLoading(true);
    getDoc(ref)
      .then(snap => {
        if (cancelled) return;
        if (!snap.exists()) {
          setData(null);
          setLoading(false);
          return;
        }
        const initial = { id: snap.id, ...snap.data() };
        setData(initial);
        setLoading(false);
        if (initial.status === 'live') {
          unsubscribe = onSnapshot(
            ref,
            s => {
              if (cancelled) return;
              if (!s.exists()) {
                setData(null);
                return;
              }
              const next = { id: s.id, ...s.data() };
              setData(next);
              if (next.status !== 'live' && unsubscribe) {
                unsubscribe();
                unsubscribe = null;
              }
            },
            err => {
              if (cancelled) return;
              console.error(`Error listening to matches/${matchId}:`, err);
              setError(err);
            }
          );
        }
      })
      .catch(err => {
        if (cancelled) return;
        console.error(`Error fetching matches/${matchId}:`, err);
        setError(err);
        setLoading(false);
      });

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [matchId]);

  return { data, loading, error };
}
