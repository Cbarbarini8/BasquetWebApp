import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useCollection } from '../hooks/useCollection';

// Suscripcion compartida a datos "cuasi-estaticos" para evitar que cada pantalla
// monte su propio onSnapshot. teams/courts/seasons son baratos (~10-20 docs totales)
// y se necesitan en casi todas las pantallas => siempre montados.
// players (~156 docs) es caro y solo lo usan stats/match-detail/admin => lazy
// subscribe con ref counting: se suscribe al primer consumer y se desuscribe
// cuando se va el ultimo.

const TEAMS_CONSTRAINTS = [orderBy('name')];
const COURTS_CONSTRAINTS = [orderBy('name')];
const SEASONS_CONSTRAINTS = [orderBy('createdAt', 'desc')];

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const teams = useCollection('teams', TEAMS_CONSTRAINTS);
  const courts = useCollection('courts', COURTS_CONSTRAINTS);
  const seasons = useCollection('seasons', SEASONS_CONSTRAINTS);

  const [players, setPlayers] = useState([]);
  const [playersLoading, setPlayersLoading] = useState(false);
  const playersRefCount = useRef(0);
  const playersUnsub = useRef(null);

  const subscribePlayers = useCallback(() => {
    playersRefCount.current += 1;
    if (playersRefCount.current === 1) {
      setPlayersLoading(true);
      const q = query(collection(db, 'players'), orderBy('lastName'));
      playersUnsub.current = onSnapshot(q, snap => {
        setPlayers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setPlayersLoading(false);
      });
    }
    return () => {
      playersRefCount.current -= 1;
      if (playersRefCount.current === 0 && playersUnsub.current) {
        playersUnsub.current();
        playersUnsub.current = null;
      }
    };
  }, []);

  return (
    <DataContext.Provider
      value={{
        teams,
        courts,
        seasons,
        players: { data: players, loading: playersLoading },
        subscribePlayers,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}

// Hook interno para consumers de players: registra/desregistra al ref-count
// del provider para que el listener solo exista mientras haya al menos un consumer.
export function usePlayersSubscription() {
  const { players, subscribePlayers } = useData();
  useEffect(() => subscribePlayers(), [subscribePlayers]);
  return players;
}
