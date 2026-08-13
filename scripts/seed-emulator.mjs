// Pobla el Firebase Emulator con datos sinteticos para validar la app sin
// tocar produccion.
//
// Uso:
//   1. Levantar el emulador en otra terminal: npm run emulators
//   2. Correr: node scripts/seed-emulator.mjs
//
// Crea: 1 owner (admin@local.test / admin123), 1 temporada activa, 1 cancha,
// 4 equipos, 10 jugadores por equipo (mix de edades incluyendo legacy sin
// birthDate), y partidos en distintos estados (scheduled, live, finished, WO).

import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, doc, setDoc, collection, writeBatch, Timestamp, serverTimestamp } from 'firebase/firestore';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';

// Cualquier valor sirve para el emulador, pero el SDK requiere los campos.
const app = initializeApp({
  apiKey: 'fake-api-key',
  authDomain: 'localhost',
  projectId: 'basquet-ef86a',
  appId: 'fake-app-id',
});

const db = getFirestore(app);
const auth = getAuth(app);
connectFirestoreEmulator(db, '127.0.0.1', 8080);
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });

const OWNER_EMAIL = 'admin@local.test';
const OWNER_PASSWORD = 'admin123';

async function ensureOwner() {
  let cred;
  try {
    cred = await createUserWithEmailAndPassword(auth, OWNER_EMAIL, OWNER_PASSWORD);
    console.log(`[auth] owner creado: ${OWNER_EMAIL}`);
  } catch (err) {
    if (err?.code === 'auth/email-already-in-use') {
      cred = await signInWithEmailAndPassword(auth, OWNER_EMAIL, OWNER_PASSWORD);
      console.log(`[auth] owner ya existia, sign-in OK: ${OWNER_EMAIL}`);
    } else {
      throw err;
    }
  }
  const uid = cred.user.uid;
  await setDoc(doc(db, 'users', uid), {
    email: OWNER_EMAIL,
    displayName: 'Admin Local',
    role: 'owner',
    permissions: {},
    active: true,
    createdAt: serverTimestamp(),
  });
  return uid;
}

const SEASON_ID = 'season-2026-apertura';
const COURT_ID = 'court-alumni';

async function seedSeasonAndCourt() {
  await setDoc(doc(db, 'seasons', SEASON_ID), {
    name: 'Apertura 2026',
    active: true,
    createdAt: serverTimestamp(),
  });
  await setDoc(doc(db, 'courts', COURT_ID), {
    name: 'Alumni',
    mapsUrl: '',
  });
  console.log('[seed] season + court');
}

const TEAMS = [
  { id: 'team-a', name: 'Aguilas',   shortName: 'AGU', primaryColor: '#2563eb' },
  { id: 'team-b', name: 'Buhos',     shortName: 'BUH', primaryColor: '#dc2626' },
  { id: 'team-c', name: 'Cobras',    shortName: 'COB', primaryColor: '#16a34a' },
  { id: 'team-d', name: 'Dragones',  shortName: 'DRA', primaryColor: '#9333ea' },
];

async function seedTeams() {
  const batch = writeBatch(db);
  TEAMS.forEach(t => {
    batch.set(doc(db, 'teams', t.id), {
      name: t.name,
      shortName: t.shortName,
      primaryColor: t.primaryColor,
      logoUrl: '',
    });
  });
  await batch.commit();
  console.log(`[seed] ${TEAMS.length} equipos`);
}

// 10 jugadores por equipo. Mix pensado para ejercitar los bordes de categoria
// (la edad es por anio de nacimiento: edadTorneo = 2026 - birthYear):
//   - 2 categoria 19-24 (edades 19, 24)  <- borde superior young
//   - 4 categoria 25-29 (edades 25, 26, 27, 29)  <- bordes 25 y 29
//   - 3 categoria 30+ (edades 30, 33, 40)  <- borde inferior senior
//   - 1 sin birthDate (legacy fallback => 30+)
// El dia/mes no afecta la categoria (solo el anio), pero se usa 12-20 a
// proposito: un jugador que cumple recien en diciembre igual cuenta con la
// edad del anio completo, que es justo lo que dice el reglamento.
function buildPlayersForTeam(teamIdx) {
  const ages = [19, 24, 25, 26, 27, 29, 30, 33, 40, null];
  const baseNumber = (teamIdx + 1) * 10;
  return ages.map((age, i) => {
    const birthDate = age == null ? '' : `${2026 - age}-12-20`;
    return {
      id: `player-${teamIdx}-${i}`,
      firstName: `Jugador${i + 1}`,
      lastName: `${TEAMS[teamIdx].shortName}${i + 1}`,
      number: baseNumber + i,
      teamId: TEAMS[teamIdx].id,
      birthDate,
      photoUrl: '',
      photoStatus: 'none',
      uploadToken: `tok-${teamIdx}-${i}`,
      active: true,
    };
  });
}

async function seedPlayers() {
  const batch = writeBatch(db);
  let count = 0;
  TEAMS.forEach((_, idx) => {
    buildPlayersForTeam(idx).forEach(p => {
      const { id, ...rest } = p;
      batch.set(doc(db, 'players', id), { ...rest, createdAt: serverTimestamp() });
      count++;
    });
  });
  await batch.commit();
  console.log(`[seed] ${count} jugadores`);
}

// Genera el match con los campos basicos (no inicializa onCourt, currentStint,
// etc — los partidos `live` igual los podes editar en cancha).
function makeMatch({ id, round, home, away, status, homeScore, awayScore, phase, walkoverNoShow, scheduledISODate, scheduledTime }) {
  const m = {
    round,
    homeTeamId: home,
    awayTeamId: away,
    homeScore: homeScore ?? 0,
    awayScore: awayScore ?? 0,
    status,
    courtId: COURT_ID,
    seasonId: SEASON_ID,
    phase: phase || 'regular',
    referee1: 'Arbitro 1',
    referee2: 'Arbitro 2',
    scheduledDate: scheduledISODate ? Timestamp.fromDate(new Date(`${scheduledISODate}T00:00:00`)) : null,
    scheduledTime: scheduledTime || '',
    timeouts: { home: {}, away: {} },
  };
  if (walkoverNoShow) m.walkoverNoShow = walkoverNoShow;
  if (status === 'live') {
    m.quarter = 1;
    m.clockRunning = false;
    m.clockRemainingMs = 10 * 60 * 1000;
    m.clockStartedAt = null;
    m.onCourtHome = [];
    m.onCourtAway = [];
    m.libres = { home: [], away: [] };
  }
  if (status === 'finished' || status === 'walkover') {
    m.finishedAt = serverTimestamp();
  }
  return { id, data: m };
}

async function seedMatches() {
  const matches = [
    // Fecha 1
    makeMatch({ id: 'match-r1-ab', round: 1, home: 'team-a', away: 'team-b',
      status: 'finished', homeScore: 80, awayScore: 72,
      scheduledISODate: '2026-04-13', scheduledTime: '20:00' }),
    makeMatch({ id: 'match-r1-cd', round: 1, home: 'team-c', away: 'team-d',
      status: 'walkover', homeScore: 20, awayScore: 0, walkoverNoShow: 'away',
      scheduledISODate: '2026-04-13', scheduledTime: '21:30' }),
    // Fecha 2
    makeMatch({ id: 'match-r2-ac', round: 2, home: 'team-a', away: 'team-c',
      status: 'finished', homeScore: 65, awayScore: 60,
      scheduledISODate: '2026-04-20', scheduledTime: '20:00' }),
    makeMatch({ id: 'match-r2-bd', round: 2, home: 'team-b', away: 'team-d',
      status: 'finished', homeScore: 75, awayScore: 70,
      scheduledISODate: '2026-04-20', scheduledTime: '21:30' }),
    // Fecha 3
    makeMatch({ id: 'match-r3-ad', round: 3, home: 'team-a', away: 'team-d',
      status: 'scheduled',
      scheduledISODate: '2026-05-04', scheduledTime: '20:00' }),
    makeMatch({ id: 'match-r3-bc', round: 3, home: 'team-b', away: 'team-c',
      status: 'scheduled',
      scheduledISODate: '2026-05-04', scheduledTime: '21:30' }),
    // Semifinal de prueba (para validar cupos de TM con phase='semifinal')
    makeMatch({ id: 'match-sf', round: 99, home: 'team-a', away: 'team-b',
      status: 'scheduled', phase: 'semifinal',
      scheduledISODate: '2026-05-18', scheduledTime: '20:00' }),
  ];

  const batch = writeBatch(db);
  matches.forEach(({ id, data }) => batch.set(doc(db, 'matches', id), data));
  await batch.commit();
  console.log(`[seed] ${matches.length} partidos`);

  // Poblar eventos minimos en los partidos finished para que las stats no
  // queden 100% vacias. Solo unos pocos eventos por partido.
  const events = [
    { matchId: 'match-r1-ab', teamId: 'team-a', playerId: 'player-0-1', type: '2pt', made: true, quarter: 1 },
    { matchId: 'match-r1-ab', teamId: 'team-a', playerId: 'player-0-2', type: '3pt', made: true, quarter: 2 },
    { matchId: 'match-r1-ab', teamId: 'team-b', playerId: 'player-1-1', type: '2pt', made: true, quarter: 1 },
    { matchId: 'match-r2-ac', teamId: 'team-a', playerId: 'player-0-3', type: '2pt', made: true, quarter: 1 },
    { matchId: 'match-r2-ac', teamId: 'team-c', playerId: 'player-2-2', type: '3pt', made: true, quarter: 3 },
    { matchId: 'match-r2-bd', teamId: 'team-b', playerId: 'player-1-2', type: '2pt', made: true, quarter: 2 },
    { matchId: 'match-r2-bd', teamId: 'team-d', playerId: 'player-3-3', type: 'foul', quarter: 2 },
  ];
  const eventBatch = writeBatch(db);
  events.forEach(e => {
    const ref = doc(collection(db, `matches/${e.matchId}/events`));
    const { matchId, ...payload } = e;
    eventBatch.set(ref, { ...payload, timestamp: serverTimestamp() });
  });
  await eventBatch.commit();
  console.log(`[seed] ${events.length} eventos en partidos finished`);
}

async function main() {
  console.log('Conectando al emulador (Firestore 127.0.0.1:8080, Auth 127.0.0.1:9099)...\n');
  await ensureOwner();
  await seedSeasonAndCourt();
  await seedTeams();
  await seedPlayers();
  await seedMatches();
  console.log('\nListo. Login en http://localhost:5173/admin/login con:');
  console.log(`  email:    ${OWNER_EMAIL}`);
  console.log(`  password: ${OWNER_PASSWORD}`);
  process.exit(0);
}

main().catch(err => { console.error('Error:', err); process.exit(1); });
