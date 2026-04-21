import { useEffect, useState } from 'react';
import { collection, getDocs, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../lib/firebase';

// Hook especifico para MatchDetailPage: carga events + stints de un partido.
// - status === 'live' => onSnapshot (tiempo real necesario para espectadores).
// - Otros (finished, scheduled) => getDocs una sola vez. No hay razon para
//   mantener listeners realtime en partidos terminados o todavia sin empezar.
// Si el match pasa de live a finished en medio de una sesion, el effect se
// re-ejecuta (cambia status en deps), cierra los listeners y hace una lectura
// unica final.
export function useMatchDetailData(match) {
  const matchId = match?.id;
  const status = match?.status;
  const [events, setEvents] = useState([]);
  const [stints, setStints] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!matchId) {
      setEvents([]);
      setStints([]);
      setLoading(true);
      return;
    }

    const eventsQ = query(
      collection(db, `matches/${matchId}/events`),
      orderBy('timestamp', 'desc')
    );
    const stintsRef = collection(db, `matches/${matchId}/playerStints`);

    if (status === 'live') {
      let eventsLoaded = false;
      let stintsLoaded = false;
      const maybeDone = () => {
        if (eventsLoaded && stintsLoaded) setLoading(false);
      };
      const unsubEvents = onSnapshot(eventsQ, snap => {
        setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        eventsLoaded = true;
        maybeDone();
      });
      const unsubStints = onSnapshot(stintsRef, snap => {
        setStints(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        stintsLoaded = true;
        maybeDone();
      });
      return () => {
        unsubEvents();
        unsubStints();
      };
    }

    let cancelled = false;
    setLoading(true);
    Promise.all([getDocs(eventsQ), getDocs(stintsRef)])
      .then(([eSnap, sSnap]) => {
        if (cancelled) return;
        setEvents(eSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setStints(sSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        console.error(`Error fetching match detail ${matchId}:`, err);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [matchId, status]);

  return { events, stints, loading };
}
