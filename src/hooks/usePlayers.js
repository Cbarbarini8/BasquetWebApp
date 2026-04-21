import { usePlayersSubscription } from '../context/DataContext';

export function usePlayers() {
  return usePlayersSubscription();
}
