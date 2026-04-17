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

export async function requestNotificationPermission(uid: string): Promise<void> {
  try {
    // FCM requires service workers — not supported in all environments
    const supported = await isSupported();
    if (!supported) {
      console.log('[FCM] Not supported in this environment.');
      return;
    }

    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    if (!vapidKey || vapidKey === 'YOUR_VAPID_KEY_HERE') {
      console.warn('[FCM] VAPID key not configured. Skipping notification setup.');
      return;
    }

    // Only request if not already decided
    if (Notification.permission === 'granted') {
      // Already granted — just (re-)register the token
    } else if (Notification.permission === 'denied') {
      console.log('[FCM] Notification permission previously denied.');
      return;
    }

    // Request browser permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('[FCM] Notification permission denied.');
      return;
    }

    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: await navigator.serviceWorker.register('/firebase-messaging-sw.js'),
    });

    if (token) {
      // Save token to Firestore so backend can send targeted notifications
      await updateDoc(doc(db, 'users', uid), { fcmToken: token });
      console.log('[FCM] Token saved for user:', uid);
    }
  } catch (err) {
    // Non-fatal: notification permission errors should never break the app
    console.error('[FCM] Error setting up notifications:', err);
  }
}
