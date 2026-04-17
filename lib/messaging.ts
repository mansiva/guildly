/**
 * FCM (Firebase Cloud Messaging) client-side helper.
 *
 * Usage:
 *   import { requestNotificationPermission } from '@/lib/messaging';
 *   await requestNotificationPermission(uid);
 *
 * SETUP REQUIRED:
 *   1. Go to Firebase Console → Project Settings → Cloud Messaging
 *   2. Under "Web Push certificates", click "Generate key pair"
 *   3. Copy the public key into NEXT_PUBLIC_FIREBASE_VAPID_KEY in .env.local
 */

import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { doc, updateDoc } from 'firebase/firestore';
import app from '@/lib/firebase';
import { db } from '@/lib/firebase';

export type NotificationResult =
  | { status: 'granted'; token: string }
  | { status: 'denied' }
  | { status: 'unsupported' }
  | { status: 'error'; message: string };

export async function requestNotificationPermission(uid: string): Promise<NotificationResult> {
  try {
    // FCM requires service workers — not supported in all environments
    const supported = await isSupported();
    if (!supported) {
      console.log('[FCM] Not supported in this environment.');
      return { status: 'unsupported' };
    }

    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.trim();
    if (!vapidKey || vapidKey === 'YOUR_VAPID_KEY_HERE') {
      console.warn('[FCM] VAPID key not configured. Skipping notification setup.');
      return { status: 'error', message: 'VAPID key not configured' };
    }

    if (Notification.permission === 'denied') {
      console.log('[FCM] Notification permission previously denied.');
      return { status: 'denied' };
    }

    // Request browser permission (will show system popup)
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('[FCM] Notification permission denied.');
      return { status: 'denied' };
    }

    // Let Firebase register and manage the SW at its own scope automatically
    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey });

    if (token) {
      await updateDoc(doc(db, 'users', uid), { fcmToken: token });
      console.log('[FCM] Token saved for user:', uid);
      return { status: 'granted', token };
    }

    return { status: 'error', message: 'Failed to get FCM token' };
  } catch (err) {
    console.error('[FCM] Error setting up notifications:', err);
    return { status: 'error', message: err instanceof Error ? err.message : String(err) };
  }
}
