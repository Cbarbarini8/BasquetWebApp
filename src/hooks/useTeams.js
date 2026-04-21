import { useData } from '../context/DataContext';

export function useTeams() {
  return useData().teams;
}
