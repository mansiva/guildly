import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, getAdminMessaging } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const { senderId, recipientId, groupId, groupName } = await req.json();

    if (!senderId || !recipientId || !groupId || !groupName) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    if (senderId === recipientId) {
      return NextResponse.json({ error: 'Cannot nudge yourself' }, { status: 400 });
    }

    const adminDb = getAdminDb();

    // ── Rate limit check (server-side) ────────────────────────────────────
    const nudgeDocId = `${senderId}_${recipientId}`;
    const nudgeRef = adminDb.doc(`nudges/${nudgeDocId}`);
    const nudgeSnap = await nudgeRef.get();

    if (nudgeSnap.exists) {
      const lastSentAt = nudgeSnap.data()?.lastSentAt?.toMillis?.() ?? 0;
      if (Date.now() - lastSentAt < SIX_HOURS_MS) {
        return NextResponse.json({ error: 'Rate limited', rateLimited: true }, { status: 429 });
      }
    }

    // ── Read sender and recipient data ────────────────────────────────────
    const [senderSnap, recipientSnap] = await Promise.all([
      adminDb.doc(`users/${senderId}`).get(),
      adminDb.doc(`users/${recipientId}`).get(),
    ]);

    const senderName = senderSnap.data()?.displayName || 'Someone';
    const fcmToken = recipientSnap.data()?.fcmToken as string | undefined;

    // ── Send FCM notification if token available ───────────────────────────
    if (fcmToken) {
      try {
        await getAdminMessaging().send({
          token: fcmToken,
          notification: {
            title: "You've been nudged! 👋",
            body: `${senderName} is nudging you to log your progress in ${groupName}!`,
          },
          webpush: {
            notification: {
              icon: '/icon-192.png',
            },
          },
        });
      } catch (fcmErr) {
        // Log but don't fail the request — nudge still counts even if notification fails
        console.error('[Nudge] FCM send failed:', fcmErr);
      }
    }

    // ── Write to notification inbox ──────────────────────────────────────
    await adminDb.collection(`notifications/${recipientId}/items`).add({
      type: 'nudge',
      fromUid: senderId,
      fromName: senderName,
      groupId,
      groupName,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    // ── Update rate limit doc ─────────────────────────────────────────────
    await nudgeRef.set(
      { lastSentAt: FieldValue.serverTimestamp(), senderId, recipientId },
      { merge: true }
    );

    // ── Increment nudgesGiven on sender ───────────────────────────────────
    await adminDb.doc(`users/${senderId}`).update({
      nudgesGiven: FieldValue.increment(1),
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('[Nudge] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
