/**
 * Compute standings from finished matches.
 * @param {Array} matches - Match docs with homeTeamId, awayTeamId, homeScore, awayScore, status
 * @param {Array} teams - Team docs with id, name, shortName
 * @param {{ pointsForWin: number, pointsForLoss: number }} config
 * @returns {Array} Sorted standings rows
 */
export function computeStandings(matches, teams, config = { pointsForWin: 2, pointsForLoss: 1 }) {
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

  const finishedMatches = matches.filter(m => m.status === 'finished');

  finishedMatches.forEach(match => {
    const home = stats[match.homeTeamId];
    const away = stats[match.awayTeamId];
    if (!home || !away) return;

    const homeScore = match.homeScore || 0;
    const awayScore = match.awayScore || 0;

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
      away.points += config.pointsForLoss;
    } else if (awayScore > homeScore) {
      away.won++;
      home.lost++;
      away.points += config.pointsForWin;
      home.points += config.pointsForLoss;
    } else {
      // Empate (raro en basquet, pero por si acaso)
      home.points += config.pointsForLoss;
      away.points += config.pointsForLoss;
    }
  });

  return Object.values(stats)
    .map(s => ({ ...s, diff: s.pointsFor - s.pointsAgainst }))
    .sort((a, b) => b.points - a.points || b.diff - a.diff || b.pointsFor - a.pointsFor);
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
  teams.forEach(t => { teamMap[t.id] = t.name; });

  const stats = {};

  players.forEach(player => {
    stats[player.id] = {
      playerId: player.id,
      playerName: `${player.firstName} ${player.lastName}`,
      playerNumber: player.number,
      teamId: player.teamId,
      teamName: teamMap[player.teamId] || '',
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
