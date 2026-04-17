import { collection, addDoc, serverTimestamp, query, where, getDocs, writeBatch, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

export async function writeNotification(
  toUid: string,
  payload: {
    type: 'reaction' | 'quest_complete' | 'quest_failed' | 'nudge';
    fromUid?: string;
    fromName?: string;
    emoji?: string;
    feedEntryId?: string;
    questTitle?: string;
    groupId?: string;
    groupName?: string;
  }
) {
  try {
    await addDoc(collection(db, 'notifications', toUid, 'items'), {
      ...payload,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    console.error('[Notifications] Failed to write:', e);
  }
}

export async function markAllRead(uid: string) {
  try {
    const snap = await getDocs(
      query(collection(db, 'notifications', uid, 'items'), where('read', '==', false))
    );
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.update(d.ref, { read: true }));
    await batch.commit();
  } catch (e) {
    console.error('[Notifications] Failed to mark read:', e);
  }
}

export async function markOneRead(uid: string, itemId: string) {
  try {
    await updateDoc(doc(db, 'notifications', uid, 'items', itemId), { read: true });
  } catch (e) {
    console.error('[Notifications] Failed to mark read:', e);
  }
}
