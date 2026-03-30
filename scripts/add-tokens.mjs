import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';
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

function generateToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 16; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];
  if (!email || !password) { console.log("Uso: node scripts/add-tokens.mjs <email> <password>"); process.exit(1); }

  await signInWithEmailAndPassword(auth, email, password);
  console.log("Autenticado\n");

  const snap = await getDocs(collection(db, "players"));
  let updated = 0;
  for (const d of snap.docs) {
    if (!d.data().uploadToken) {
      await updateDoc(doc(db, "players", d.id), {
        uploadToken: generateToken(),
        photoUrl: d.data().photoUrl || '',
        photoStatus: d.data().photoUrl ? 'approved' : 'none',
      });
      updated++;
      process.stdout.write(`  ${d.data().lastName}, ${d.data().firstName} -> token generado\n`);
    }
  }
  console.log(`\n${updated} jugadores actualizados`);
  process.exit(0);
}

main().catch(err => { console.error(err.message); process.exit(1); });
