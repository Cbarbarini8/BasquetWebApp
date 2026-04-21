import { useData } from '../context/DataContext';

export function useCourts() {
  return useData().courts;
}
