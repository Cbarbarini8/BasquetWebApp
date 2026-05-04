// Setea un escenario de TRIPLE EMPATE en el emulador para validar la cascada
// FIBA de desempates (mini-tabla con cascada miniWon -> miniDiff -> miniFor).
//
// Pre-requisito: haber corrido `npm run seed:emulator` una vez. Este script
// SOLO modifica 3 partidos:
//  - r2-ac: Cobras 65-60 Aguilas (cambia el ganador, antes era Aguilas)
//  - r3-ad: Aguilas 85-65 Dragones (de scheduled a finished)
//  - r3-bc: Buhos 75-72 Cobras (de scheduled a finished)
//
// Resultado esperado en /standings:
//   1. Aguilas  5 pts  (miniDiff +3 en cascada)
//   2. Cobras   5 pts  (miniDiff +2)
//   3. Buhos    5 pts  (miniDiff -5)
//   4. Dragones 2 pts
//
// Los 3 primeros estan empatados a 5 pts y se desempatan via mini-tabla
// (criterion 1 miniWon todos a 1, pasa al criterion 2 miniDiff que resuelve).

import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

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

// Las reglas de Firestore exigen request.auth != null para escrituras en
// matches. Reusa el owner del seed (admin@local.test). Si no existe (porque
// nunca se corrio seed-emulator), lo crea.
async function ensureAuth() {
  const email = 'admin@local.test';
  const password = 'admin123';
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    if (err?.code === 'auth/user-not-found' || err?.code === 'auth/invalid-credential') {
      await createUserWithEmailAndPassword(auth, email, password);
      console.log('[auth] owner no existia, lo cree');
    } else {
      throw err;
    }
  }
}

const updates = [
  {
    id: 'match-r2-ac',
    data: {
      homeScore: 60,
      awayScore: 65,
      // status se mantiene 'finished'
    },
    label: 'r2-ac: Cobras 65-60 Aguilas (antes: Aguilas ganaba)',
  },
  {
    id: 'match-r3-ad',
    data: {
      status: 'finished',
      homeScore: 85,
      awayScore: 65,
      finishedAt: serverTimestamp(),
    },
    label: 'r3-ad: Aguilas 85-65 Dragones (de scheduled a finished)',
  },
  {
    id: 'match-r3-bc',
    data: {
      status: 'finished',
      homeScore: 75,
      awayScore: 72,
      finishedAt: serverTimestamp(),
    },
    label: 'r3-bc: Buhos 75-72 Cobras (de scheduled a finished)',
  },
];

async function main() {
  console.log('Conectando al emulador (Firestore 127.0.0.1:8080, Auth 127.0.0.1:9099)...');
  await ensureAuth();
  console.log('[auth] sign-in OK\n');
  for (const u of updates) {
    await updateDoc(doc(db, 'matches', u.id), u.data);
    console.log(`[update] ${u.label}`);
  }
  console.log('\nListo. Verifica /standings — el orden esperado es:');
  console.log('  1. Aguilas  5 pts');
  console.log('  2. Cobras   5 pts');
  console.log('  3. Buhos    5 pts');
  console.log('  4. Dragones 2 pts');
  console.log('\nLos 3 primeros estan empatados a 5 pts y se desempatan por mini-tabla:');
  console.log('  - miniWon: 1-1-1 (no resuelve)');
  console.log('  - miniDiff: A(+3) > C(+2) > B(-5) -> resuelve');
  process.exit(0);
}

main().catch(err => { console.error('Error:', err); process.exit(1); });
