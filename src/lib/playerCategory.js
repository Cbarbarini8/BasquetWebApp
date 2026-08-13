// Categorias por edad segun reglamento (Liga Comercial):
// - 19-24 anios: max 5 por plantel, max 2 simultaneos en cancha
// - 25-29 anios: max 6 por plantel, sin limite en cancha
// - 30+: sin limites
//
// IMPORTANTE — la edad se calcula POR ANIO DE NACIMIENTO (la edad que el
// jugador cumple durante el anio del torneo), NO por edad cumplida al dia de
// hoy. El reglamento dice que si cumple 25 durante el torneo se lo toma como
// 25-29, y lo mismo al cumplir 30. De esta forma la categoria de un jugador es
// estable durante toda la temporada y no cambia el dia de su cumpleanios.
//   edadTorneo = anioTorneo - anioNacimiento
//   nacido 2001 -> 25 en 2026 (categoria 25-29) aunque cumpla en diciembre.
//
// Jugadores sin birthDate se asumen 30+ (regla de gracia para migracion de
// datos legacy: no participan de cupos hasta que se les cargue la fecha real).

export const CATEGORY_YOUNG = 'young';
export const CATEGORY_MID = 'mid';
export const CATEGORY_SENIOR = 'senior';

export const CATEGORY_LABEL = {
  [CATEGORY_YOUNG]: '19-24',
  [CATEGORY_MID]: '25-29',
  [CATEGORY_SENIOR]: '30+',
};

export const TEAM_QUOTA = {
  [CATEGORY_YOUNG]: 5,
  [CATEGORY_MID]: 6,
  [CATEGORY_SENIOR]: null,
};

export const ON_COURT_QUOTA = {
  [CATEGORY_YOUNG]: 2,
  [CATEGORY_MID]: null,
  [CATEGORY_SENIOR]: null,
};

// Anio calendario en curso — default del anio de torneo cuando el llamador no
// tiene a mano la temporada ni la fecha del partido.
export function currentSeasonYear() {
  return new Date().getFullYear();
}

// Deriva el anio del torneo desde un doc de temporada ({ name, createdAt }),
// una fecha ISO ('2026-04-12') o un string que contenga el anio ('Apertura
// 2026'). Cae al anio calendario actual si no logra extraerlo.
export function seasonYearFrom(source) {
  if (!source) return currentSeasonYear();
  if (typeof source === 'number') return source;
  if (source instanceof Date) {
    return isNaN(source.getTime()) ? currentSeasonYear() : source.getFullYear();
  }
  if (typeof source === 'string') {
    const m = source.match(/(19|20)\d{2}/);
    return m ? Number(m[0]) : currentSeasonYear();
  }
  // Doc de temporada: primero el nombre ("Apertura 2026"), luego createdAt.
  if (typeof source.name === 'string') {
    const m = source.name.match(/(19|20)\d{2}/);
    if (m) return Number(m[0]);
  }
  const created = source.createdAt?.toDate?.() || source.createdAt;
  if (created instanceof Date && !isNaN(created.getTime())) return created.getFullYear();
  return currentSeasonYear();
}

// Anio de nacimiento. Parsea 'yyyy-mm-dd' a mano para no depender de la zona
// horaria (new Date('2001-01-01') se interpreta como UTC y en UTC-3 cae en
// 2000, corriendo el anio).
function birthYearOf(birthDate) {
  if (!birthDate) return null;
  if (birthDate instanceof Date) {
    return isNaN(birthDate.getTime()) ? null : birthDate.getFullYear();
  }
  if (typeof birthDate === 'string') {
    const iso = birthDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
      const d = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00`);
      return isNaN(d.getTime()) ? null : Number(iso[1]);
    }
  }
  const d = new Date(birthDate);
  return isNaN(d.getTime()) ? null : d.getFullYear();
}

// Edad reglamentaria: la que el jugador cumple durante el anio del torneo.
// Esta es la que define la categoria. Devuelve null si no hay fecha valida.
export function seasonAge(birthDate, seasonYear = currentSeasonYear()) {
  const year = birthYearOf(birthDate);
  if (year === null) return null;
  return seasonYear - year;
}

// Edad cumplida a la fecha (real, calendario). Solo para mostrar — los cupos
// se calculan con seasonAge. Devuelve null si la fecha no esta seteada o es
// invalida.
export function computeAge(birthDate, refDate = new Date()) {
  if (!birthDate) return null;
  let dob;
  if (birthDate instanceof Date) {
    dob = birthDate;
  } else if (typeof birthDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(birthDate)) {
    dob = new Date(`${birthDate.slice(0, 10)}T00:00:00`);
  } else {
    dob = new Date(birthDate);
  }
  if (isNaN(dob.getTime())) return null;
  let age = refDate.getFullYear() - dob.getFullYear();
  const m = refDate.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && refDate.getDate() < dob.getDate())) age--;
  return age;
}

// Categoria reglamentaria del jugador para el anio de torneo dado.
// Sin birthDate -> senior (no afecta cupos).
// Menores de 19 caen en la categoria joven: el reglamento no los contempla,
// pero contarlos como senior los dejaria fuera de todo cupo y habilitados como
// libres, que es justo lo contrario de la intencion de la regla.
export function categoryFor(birthDate, seasonYear) {
  const age = seasonAge(birthDate, seasonYear);
  if (age === null) return CATEGORY_SENIOR;
  if (age <= 24) return CATEGORY_YOUNG;
  if (age <= 29) return CATEGORY_MID;
  return CATEGORY_SENIOR;
}

// { young, mid, senior } cuenta de jugadores por categoria en el array.
export function countByCategory(players, seasonYear) {
  const counts = { [CATEGORY_YOUNG]: 0, [CATEGORY_MID]: 0, [CATEGORY_SENIOR]: 0 };
  players.forEach(p => {
    counts[categoryFor(p.birthDate, seasonYear)]++;
  });
  return counts;
}
