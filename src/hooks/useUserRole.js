import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

const SECTIONS = ['seasons', 'teams', 'players', 'courts', 'fixture', 'matches', 'scoring', 'posts'];

export function useUserRole(uid) {
  const [userDoc, setUserDoc] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setUserDoc(null);
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, 'users', uid),
      (snapshot) => {
        if (snapshot.exists()) {
          setUserDoc({ id: snapshot.id, ...snapshot.data() });
        } else {
          setUserDoc(null);
        }
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsubscribe();
  }, [uid]);

  const isOwner = userDoc?.role === 'owner';
  const isActive = userDoc?.active === true;

  const hasPermission = (section, level = 'view') => {
    if (!userDoc || !isActive) return false;
    if (isOwner) return true;
    const perm = userDoc.permissions?.[section];
    if (level === 'view') return perm === 'view' || perm === 'edit';
    if (level === 'edit') return perm === 'edit';
    return false;
  };

  const canView = (section) => hasPermission(section, 'view');
  const canEdit = (section) => hasPermission(section, 'edit');

  return {
    userDoc,
    loading,
    isOwner,
    isActive,
    hasPermission,
    canView,
    canEdit,
    SECTIONS,
  };
}
