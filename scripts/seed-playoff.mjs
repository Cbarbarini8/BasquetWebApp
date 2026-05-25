// Seed del emulador para testear el flujo de PLAYOFFS:
//   - Crea owner, 1 season activa, 1 court
//   - 10 equipos con jugadores
//   - Fixture regular round-robin completo, TODOS finished, con scores que
//     producen una tabla con 1°..10° distinguibles (sin empates incomodos)
//   - NO genera el bracket — eso lo hace el admin via "Generar Playoffs"
//
// Uso:
//   1. Levantar emulador en otra terminal: npm run emulators (o :fresh)
//   2. Correr: npm run seed:playoff
//   3. Abrir http://localhost:5173/admin con admin@local.test / admin123,
//      ir a Fixture, click "Generar Playoffs".

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  setDoc,
  collection,
  writeBatch,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import {
  getAuth,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';

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
const SEASON_ID = 'season-2026-apertura';
const COURT_ID = 'court-alumni';

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

// 10 equipos pensados para que el seeding final sea inequivoco:
// 1° Aguilas (5 wins), 2° Buhos (4w + buena diff), 3° Cobras (4w), 4° Delfines,
// 5° Elefantes, 6° Felinos, 7° Gallos, 8° Halcones, 9° Iguanas, 10° Jaguares
const TEAMS = [
  { id: 'team-aguilas',   name: 'Aguilas',   shortName: 'AGU', color: '#2563eb' },
  { id: 'team-buhos',     name: 'Buhos',     shortName: 'BUH', color: '#dc2626' },
  { id: 'team-cobras',    name: 'Cobras',    shortName: 'COB', color: '#16a34a' },
  { id: 'team-delfines',  name: 'Delfines',  shortName: 'DEL', color: '#9333ea' },
  { id: 'team-elefantes', name: 'Elefantes', shortName: 'ELE', color: '#0891b2' },
  { id: 'team-felinos',   name: 'Felinos',   shortName: 'FEL', color: '#ea580c' },
  { id: 'team-gallos',    name: 'Gallos',    shortName: 'GAL', color: '#facc15' },
  { id: 'team-halcones',  name: 'Halcones',  shortName: 'HAL', color: '#475569' },
  { id: 'team-iguanas',   name: 'Iguanas',   shortName: 'IGU', color: '#10b981' },
  { id: 'team-jaguares',  name: 'Jaguares',  shortName: 'JAG', color: '#7c3aed' },
];

async function seedTeams() {
  const batch = writeBatch(db);
  TEAMS.forEach(t => {
    batch.set(doc(db, 'teams', t.id), {
      name: t.name,
      shortName: t.shortName,
      primaryColor: t.color,
      logoUrl: '',
    });
  });
  await batch.commit();
  console.log(`[seed] ${TEAMS.length} equipos`);
}

// 8 jugadores por equipo, mix de edades para validar las cuotas
function buildPlayersForTeam(teamIdx) {
  const ages = [22, 26, 28, 30, 32, 35, 38, null];
  const baseNumber = (teamIdx + 1) * 10;
  return ages.map((age, i) => {
    const birthDate = age == null ? '' : `${2026 - age}-01-15`;
    return {
      id: `player-${TEAMS[teamIdx].id}-${i}`,
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

// Genera un round-robin (todos contra todos, 9 fechas para 10 equipos) y
// asigna scores deterministicos para que las wins queden:
//   #wins por equipo: 9, 8, 7, 6, 5, 4, 3, 2, 1, 0
//   (en orden Aguilas, Buhos, ..., Jaguares — index del array TEAMS)
// Idea: el equipo de index i le gana a TODOS los equipos con index > i, y
// pierde con todos los de index <= i-1. Asi cada equipo queda con (N-1-i) wins.
function generateRoundRobin(teamIds) {
  const teams = [...teamIds];
  if (teams.length % 2 !== 0) teams.push(null);
  const n = teams.length;
  const rounds = [];
  for (let round = 0; round < n - 1; round++) {
    const matches = [];
    for (let i = 0; i < n / 2; i++) {
      const home = teams[i];
      const away = teams[n - 1 - i];
      if (home && away) matches.push({ homeTeamId: home, awayTeamId: away });
    }
    rounds.push(matches);
    const last = teams.pop();
    teams.splice(1, 0, last);
  }
  return rounds;
}

function scoreForMatch(homeIdx, awayIdx) {
  // Equipo con index menor (mejor seed) le gana al de mayor index.
  // Margen variable para producir diff distinguibles.
  const margin = Math.abs(awayIdx - homeIdx) * 3 + 5; // 5..32 puntos margen
  const baseHigh = 70 + (10 - Math.max(homeIdx, awayIdx)); // un poco mas para mejores
  const baseLow = baseHigh - margin;
  if (homeIdx < awayIdx) {
    // gana home
    return { homeScore: baseHigh, awayScore: baseLow };
  } else {
    return { homeScore: baseLow, awayScore: baseHigh };
  }
}

async function seedMatches() {
  const teamIds = TEAMS.map(t => t.id);
  const teamIdxById = Object.fromEntries(TEAMS.map((t, i) => [t.id, i]));
  const rounds = generateRoundRobin(teamIds);

  // Fechas: 1° fecha 2026-03-07, una por semana
  const startDate = new Date('2026-03-07T00:00:00');
  const matchDocs = [];
  rounds.forEach((roundMatches, rIdx) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + rIdx * 7);
    const iso = date.toISOString().split('T')[0];
    roundMatches.forEach((m, mIdx) => {
      const homeIdx = teamIdxById[m.homeTeamId];
      const awayIdx = teamIdxById[m.awayTeamId];
      const { homeScore, awayScore } = scoreForMatch(homeIdx, awayIdx);
      const docData = {
        round: rIdx + 1,
        homeTeamId: m.homeTeamId,
        awayTeamId: m.awayTeamId,
        homeScore,
        awayScore,
        status: 'finished',
        courtId: COURT_ID,
        seasonId: SEASON_ID,
        phase: 'regular',
        scheduledDate: Timestamp.fromDate(new Date(`${iso}T00:00:00`)),
        scheduledTime: mIdx === 0 ? '20:00' : '21:30',
        timeouts: { home: {}, away: {} },
        quarter: 4,
        finishedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      };
      matchDocs.push(docData);
    });
  });

  // Batches de 400 ops para evitar limite de Firestore
  let written = 0;
  for (let i = 0; i < matchDocs.length; i += 400) {
    const batch = writeBatch(db);
    matchDocs.slice(i, i + 400).forEach(data => {
      batch.set(doc(collection(db, 'matches')), data);
      written++;
    });
    await batch.commit();
  }
  console.log(`[seed] ${written} partidos regulares finished`);
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
  console.log('\nProximos pasos para testear playoffs:');
  console.log('  1. Tab "Fixture" → click "Generar Playoffs"');
  console.log('  2. Confirma el seeding y revisa el bracket en el fixture publico');
  console.log('  3. Tab "Partidos": juega play-in y QF, mira como se materializan SF/Final');
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
