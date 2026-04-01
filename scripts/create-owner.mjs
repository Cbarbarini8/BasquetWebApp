import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyB6T2b66U9vakEBxcOad0uTXB3cO0g5tuk",
  authDomain: "basquet-ef86a.firebaseapp.com",
  projectId: "basquet-ef86a",
  storageBucket: "basquet-ef86a.firebasestorage.app",
  messagingSenderId: "584628945388",
  appId: "1:584628945388:web:6a320b6842b3a59dabc0c9",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];
  const displayName = process.argv[4] || '';

  if (!email || !password) {
    console.log("Uso: node scripts/create-owner.mjs <email> <password> [nombre]");
    process.exit(1);
  }

  console.log("Autenticando...");
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;
  console.log(`UID: ${uid}`);

  await setDoc(doc(db, 'users', uid), {
    email,
    displayName: displayName || email,
    role: 'owner',
    permissions: {},
    active: true,
    createdAt: serverTimestamp(),
  });

  console.log(`\nUsuario owner creado: ${email} (${uid})`);
  console.log("Ya podes loguearte y vas a tener acceso total.");
  process.exit(0);
}

main().catch(err => { console.error(err.message); process.exit(1); });
