import { useData } from '../context/DataContext';

export function useSeasons() {
  return useData().seasons;
}
