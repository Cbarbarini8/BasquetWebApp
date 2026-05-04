// Categorias por edad segun reglamento (Liga Comercial 2026):
// - 20-25 anios: max 3 por equipo, max 2 simultaneos en cancha
// - 26-30 anios: max 6 por equipo, sin limite en cancha
// - 31+: sin limites
// Jugadores sin birthDate se asumen +30 (regla de gracia para migracion de
// datos legacy: no participan de cupos hasta que se les cargue la fecha real).

export const CATEGORY_YOUNG = 'young';
export const CATEGORY_MID = 'mid';
export const CATEGORY_SENIOR = 'senior';

export const CATEGORY_LABEL = {
  [CATEGORY_YOUNG]: '20-25',
  [CATEGORY_MID]: '26-30',
  [CATEGORY_SENIOR]: '+30',
};

export const TEAM_QUOTA = {
  [CATEGORY_YOUNG]: 3,
  [CATEGORY_MID]: 6,
  [CATEGORY_SENIOR]: null,
};

export const ON_COURT_QUOTA = {
  [CATEGORY_YOUNG]: 2,
  [CATEGORY_MID]: null,
  [CATEGORY_SENIOR]: null,
};

// Edad en anios cumplidos al refDate. Devuelve null si la fecha no esta seteada
// o es invalida.
export function computeAge(birthDate, refDate = new Date()) {
  if (!birthDate) return null;
  const dob = birthDate instanceof Date ? birthDate : new Date(birthDate);
  if (isNaN(dob.getTime())) return null;
  let age = refDate.getFullYear() - dob.getFullYear();
  const m = refDate.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && refDate.getDate() < dob.getDate())) age--;
  return age;
}

// Categoria reglamentaria del jugador. Sin birthDate -> senior (no afecta cupos).
export function categoryFor(birthDate, refDate) {
  const age = computeAge(birthDate, refDate);
  if (age === null) return CATEGORY_SENIOR;
  if (age >= 20 && age <= 25) return CATEGORY_YOUNG;
  if (age >= 26 && age <= 30) return CATEGORY_MID;
  return CATEGORY_SENIOR;
}

// { young, mid, senior } cuenta de jugadores por categoria en el array.
export function countByCategory(players, refDate) {
  const counts = { [CATEGORY_YOUNG]: 0, [CATEGORY_MID]: 0, [CATEGORY_SENIOR]: 0 };
  players.forEach(p => {
    counts[categoryFor(p.birthDate, refDate)]++;
  });
  return counts;
}
