import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
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
