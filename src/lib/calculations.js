// Construye una mini-tabla limitada a los partidos jugados entre `teams`.
// Devuelve { [teamId]: { miniWon, miniDiff, miniFor } }.
function buildMiniTable(teams, playedMatches) {
  const ids = new Set(teams.map(t => t.teamId));
  const stats = {};
  teams.forEach(t => {
    stats[t.teamId] = { miniWon: 0, miniDiff: 0, miniFor: 0 };
  });
  playedMatches.forEach(m => {
    if (!ids.has(m.homeTeamId) || !ids.has(m.awayTeamId)) return;
    const home = stats[m.homeTeamId];
    const away = stats[m.awayTeamId];
    const hs = m.homeScore || 0;
    const as = m.awayScore || 0;
    home.miniFor += hs;
    home.miniDiff += hs - as;
    away.miniFor += as;
    away.miniDiff += as - hs;
    if (hs > as) home.miniWon++;
    else if (as > hs) away.miniWon++;
  });
  return stats;
}

// Wins de A vs B en sus enfrentamientos directos.
function headToHeadWins(teamA, teamB, playedMatches) {
  let aWins = 0;
  let bWins = 0;
  playedMatches.forEach(m => {
    const isAvB = m.homeTeamId === teamA && m.awayTeamId === teamB;
    const isBvA = m.homeTeamId === teamB && m.awayTeamId === teamA;
    if (!isAvB && !isBvA) return;
    const hs = m.homeScore || 0;
    const as = m.awayScore || 0;
    if (hs > as) {
      if (isAvB) aWins++; else bWins++;
    } else if (as > hs) {
      if (isAvB) bWins++; else aWins++;
    }
  });
  return { aWins, bWins };
}

// Desempate entre 2 equipos. Reglamento: solo head-to-head, sin goles a/c.
// Si por algun motivo no hay partidos disputados (caso teorico fuera del
// torneo), fallback determinista por teamId para evitar render no estable.
function breakTie2(teams, playedMatches) {
  const [a, b] = teams;
  const { aWins, bWins } = headToHeadWins(a.teamId, b.teamId, playedMatches);
  if (aWins > bWins) return [a, b];
  if (bWins > aWins) return [b, a];
  return [a, b].sort((x, y) => String(x.teamId).localeCompare(String(y.teamId)));
}

// Cascada para 3+ empatados: aplica criterios en orden, reconstruyendo la
// mini-tabla cuando un subgrupo se reduce. Si un subgrupo termina con 2
// equipos en cualquier nivel, se desempata por head-to-head (criterio 1).
// Criterios: ['miniWon', 'miniDiff', 'miniFor']. Si todos quedan iguales,
// fallback determinista (representa el sorteo del reglamento).
function cascadeTieBreak(teams, playedMatches, criteria) {
  if (teams.length <= 1) return teams;
  if (teams.length === 2) return breakTie2(teams, playedMatches);
  if (criteria.length === 0) {
    return [...teams].sort((a, b) => String(a.teamId).localeCompare(String(b.teamId)));
  }
  // La mini-tabla se reconstruye SOLO con los equipos aun empatados.
  const stats = buildMiniTable(teams, playedMatches);
  const [crit, ...rest] = criteria;
  const sorted = [...teams].sort((a, b) =>
    stats[b.teamId][crit] - stats[a.teamId][crit]
  );
  const result = [];
  let i = 0;
  while (i < sorted.length) {
    const v = stats[sorted[i].teamId][crit];
    const group = [];
    while (i < sorted.length && stats[sorted[i].teamId][crit] === v) {
      group.push(sorted[i]);
      i++;
    }
    if (group.length === 1) result.push(group[0]);
    else if (group.length === 2) result.push(...breakTie2(group, playedMatches));
    else result.push(...cascadeTieBreak(group, playedMatches, rest));
  }
  return result;
}

function resolveTiedGroup(teams, playedMatches) {
  if (teams.length <= 1) return teams;
  if (teams.length === 2) return breakTie2(teams, playedMatches);
  return cascadeTieBreak(teams, playedMatches, ['miniWon', 'miniDiff', 'miniFor']);
}

/**
 * Compute standings from finished and walkover matches.
 * Reglamento Liga Comercial 2026:
 *  - Ganador: pointsForWin (default 2)
 *  - Perdedor: pointsForLoss (default 1)
 *  - WO (no presentado): pointsForWO (default 0) — anula la suma de 1 que da
 *    perder un partido jugado.
 *
 * Desempates (FIBA con adaptaciones del reglamento):
 *  - 2 equipos empatados: solo resultado directo (head-to-head). Sin goles a/c.
 *  - 3+ equipos empatados: mini-tabla con cascada (mas victorias mini → mejor
 *    diff mini → mas puntos a favor mini). Si un subgrupo se reduce a 2 en
 *    cualquier nivel, vuelve a head-to-head. Si la cascada se agota
 *    (criterion exhausted), fallback determinista (representa el sorteo).
 * @param {Array} matches - Match docs with homeTeamId, awayTeamId, homeScore, awayScore, status, walkoverNoShow
 * @param {Array} teams - Team docs with id, name, shortName
 * @param {{ pointsForWin: number, pointsForLoss: number, pointsForWO: number }} config
 * @returns {Array} Sorted standings rows
 */
export function computeStandings(matches, teams, config = { pointsForWin: 2, pointsForLoss: 1, pointsForWO: 0 }) {
  const stats = {};

  teams.forEach(team => {
    stats[team.id] = {
      teamId: team.id,
      teamName: team.name,
      shortName: team.shortName || team.name.substring(0, 3).toUpperCase(),
      logoUrl: team.logoUrl || null,
      played: 0,
      won: 0,
      lost: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      diff: 0,
      points: 0,
    };
  });

  const countedMatches = matches.filter(m => m.status === 'finished' || m.status === 'walkover');

  countedMatches.forEach(match => {
    const home = stats[match.homeTeamId];
    const away = stats[match.awayTeamId];
    if (!home || !away) return;

    const homeScore = match.homeScore || 0;
    const awayScore = match.awayScore || 0;
    const isWO = match.status === 'walkover';
    const loserPoints = isWO ? config.pointsForWO : config.pointsForLoss;

    home.played++;
    away.played++;
    home.pointsFor += homeScore;
    home.pointsAgainst += awayScore;
    away.pointsFor += awayScore;
    away.pointsAgainst += homeScore;

    if (homeScore > awayScore) {
      home.won++;
      away.lost++;
      home.points += config.pointsForWin;
      away.points += loserPoints;
    } else if (awayScore > homeScore) {
      away.won++;
      home.lost++;
      away.points += config.pointsForWin;
      home.points += loserPoints;
    } else {
      // Empate (raro en basquet, pero por si acaso)
      home.points += config.pointsForLoss;
      away.points += config.pointsForLoss;
    }
  });

  const rows = Object.values(stats).map(s => ({ ...s, diff: s.pointsFor - s.pointsAgainst }));
  // Orden inicial por puntos. Despues, dentro de cada grupo de igual puntaje,
  // aplicamos los desempates del reglamento (head-to-head / mini-tabla).
  rows.sort((a, b) => b.points - a.points);

  const result = [];
  let i = 0;
  while (i < rows.length) {
    const points = rows[i].points;
    const group = [];
    while (i < rows.length && rows[i].points === points) {
      group.push(rows[i]);
      i++;
    }
    result.push(...resolveTiedGroup(group, countedMatches));
  }
  return result;
}

/**
 * Compute player statistics from match events.
 * @param {Array} events - All event docs across matches
 * @param {Array} players - Player docs with id, firstName, lastName, number, teamId
 * @param {Array} teams - Team docs for team name lookup
 * @returns {Array} Player stat rows
 */
export function computePlayerStats(events, players, teams) {
  const teamMap = {};
  teams.forEach(t => { teamMap[t.id] = { name: t.name, logoUrl: t.logoUrl || '' }; });

  const stats = {};

  players.forEach(player => {
    const team = teamMap[player.teamId] || { name: '', logoUrl: '' };
    stats[player.id] = {
      playerId: player.id,
      playerName: `${player.firstName} ${player.lastName}`,
      playerNumber: player.number,
      playerPhotoUrl: player.photoUrl || '',
      teamId: player.teamId,
      teamName: team.name,
      teamLogoUrl: team.logoUrl,
      gamesPlayed: 0,
      points: 0,
      twoMade: 0,
      twoAttempted: 0,
      threeMade: 0,
      threeAttempted: 0,
      ftMade: 0,
      ftAttempted: 0,
      fouls: 0,
      assists: 0,
      offRebounds: 0,
      defRebounds: 0,
      rebounds: 0,
      steals: 0,
      blocks: 0,
      turnovers: 0,
      _matchIds: new Set(),
    };
  });

  events.forEach(event => {
    const s = stats[event.playerId];
    if (!s) return;

    if (event.matchId) {
      s._matchIds.add(event.matchId);
    }

    switch (event.type) {
      case '2pt':
        s.twoAttempted++;
        if (event.made) {
          s.twoMade++;
          s.points += 2;
        }
        break;
      case '3pt':
        s.threeAttempted++;
        if (event.made) {
          s.threeMade++;
          s.points += 3;
        }
        break;
      case 'ft':
        s.ftAttempted++;
        if (event.made) {
          s.ftMade++;
          s.points += 1;
        }
        break;
      case 'foul':
      case 'foulTech':
      case 'foulUnsport':
        s.fouls++;
        break;
      case 'assist':
        s.assists++;
        break;
      case 'offRebound':
        s.offRebounds++;
        s.rebounds++;
        break;
      case 'defRebound':
        s.defRebounds++;
        s.rebounds++;
        break;
      case 'steal':
        s.steals++;
        break;
      case 'block':
        s.blocks++;
        break;
      case 'turnover':
        s.turnovers++;
        break;
    }
  });

  return Object.values(stats)
    .map(s => {
      const { _matchIds, ...rest } = s;
      return {
        ...rest,
        gamesPlayed: _matchIds.size,
        twoPct: s.twoAttempted > 0 ? Math.round((s.twoMade / s.twoAttempted) * 100) : 0,
        threePct: s.threeAttempted > 0 ? Math.round((s.threeMade / s.threeAttempted) * 100) : 0,
        ftPct: s.ftAttempted > 0 ? Math.round((s.ftMade / s.ftAttempted) * 100) : 0,
      };
    })
    .sort((a, b) => b.points - a.points);
}
