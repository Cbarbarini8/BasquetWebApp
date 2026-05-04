import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getAnalytics, isSupported } from 'firebase/analytics';


const measurementId = import.meta.env.VITE_FIREBASE_MEASUREMENT_ID;
const useEmulator = import.meta.env.VITE_USE_EMULATOR === 'true';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  ...(measurementId && !useEmulator ? { measurementId } : {}),
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

if (useEmulator) {
  // El emulador no requiere credenciales reales: cualquier valor en
  // firebaseConfig sirve. Conectamos antes de cualquier operacion.
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  // eslint-disable-next-line no-console
  console.info('[firebase] Emulator mode: Firestore @ 127.0.0.1:8080, Auth @ 127.0.0.1:9099');
}

// Analytics: solo si el proyecto tiene Google Analytics habilitado y el browser
// lo soporta (no funciona en SSR / algunos contextos privados). Sin medirSet
// no falla, simplemente no registra. Se desactiva en modo emulador para no
// contaminar la cuenta GA con eventos de testing.
export let analytics = null;
if (measurementId && !useEmulator) {
  isSupported().then(ok => {
    if (ok) analytics = getAnalytics(app);
  }).catch(() => { /* ignore */ });
}
