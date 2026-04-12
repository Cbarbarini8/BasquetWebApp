import { collection, addDoc, doc, getDoc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export async function logAction(user, action, col, documentId, description, details = null) {
  try {
    await addDoc(collection(db, 'auditLog'), {
      userId: user.uid,
      userEmail: user.email,
      action,
      collection: col,
      documentId: documentId || null,
      description,
      details,
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.error('Error writing audit log:', err);
  }
}

// Registra UNA sola entrada de auditoria por usuario+partido cuando carga estadisticas.
// Usa match.scoredBy como marcador para evitar duplicar entradas.
export async function logStatsParticipation(user, matchId, matchLabel) {
  if (!user || !matchId) return;
  try {
    const ref = doc(db, 'matches', matchId);
    const snap = await getDoc(ref);
    const scoredBy = snap.data()?.scoredBy || [];
    if (scoredBy.includes(user.uid)) return;
    await updateDoc(ref, { scoredBy: arrayUnion(user.uid) });
    await logAction(user, 'stats', 'matches', matchId, `Cargo estadisticas: ${matchLabel}`);
  } catch (err) {
    console.error('Error logging stats participation:', err);
  }
}
