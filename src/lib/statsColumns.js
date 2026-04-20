// Columnas de /stats que el admin puede ocultar desde Ajustes.
// Las columnas de identidad (posicion, nombre, equipo) no se ocultan.
export const HIDEABLE_STATS_COLUMNS = [
  { key: 'gamesPlayed', label: 'PJ (Partidos jugados)' },
  { key: 'points', label: 'Pts (Puntos)' },
  { key: 'twoMade', label: '2PC (2 puntos convertidos / intentados)' },
  { key: 'twoPct', label: '2P% (Porcentaje de 2)' },
  { key: 'threeMade', label: '3PC (3 puntos convertidos / intentados)' },
  { key: 'threePct', label: '3P% (Porcentaje de 3)' },
  { key: 'ftMade', label: 'TLC (Tiros libres convertidos / intentados)' },
  { key: 'ftPct', label: 'TL% (Porcentaje de tiros libres)' },
  { key: 'rebounds', label: 'Reb (Rebotes)' },
  { key: 'assists', label: 'Ast (Asistencias)' },
  { key: 'steals', label: 'Rob (Robos)' },
  { key: 'blocks', label: 'Tap (Tapones)' },
  { key: 'turnovers', label: 'Per (Perdidas)' },
  { key: 'fouls', label: 'Fal (Faltas)' },
];
