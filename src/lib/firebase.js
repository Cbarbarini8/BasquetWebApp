import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getAnalytics, isSupported } from 'firebase/analytics';


const measurementId = import.meta.env.VITE_FIREBASE_MEASUREMENT_ID;

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  ...(measurementId ? { measurementId } : {}),
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Analytics: solo si el proyecto tiene Google Analytics habilitado y el browser
// lo soporta (no funciona en SSR / algunos contextos privados). Sin medirSet
// no falla, simplemente no registra.
export let analytics = null;
if (measurementId) {
  isSupported().then(ok => {
    if (ok) analytics = getAnalytics(app);
  }).catch(() => { /* ignore */ });
}
