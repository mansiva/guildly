'use client';

/**
 * QuestCompletionWatcher — mounted globally in AppShell.
 *
 * On mount, checks all the user's groups for completed quests the user
 * contributed to but hasn't seen the animation for yet.
 * Only shows quests completed in the last 7 days to avoid flooding a new device
 * with historical completions.
 *
 * Pushes overlays into NotificationContext so they render in AppShell and can
 * also be triggered from the notification sheet tap.
 */

import { useEffect, useCallback } from 'react';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useNotificationSheet, QuestOverlayData } from '@/context/NotificationContext';
import { Quest, Group } from '@/types';

function readCache<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const SEEN_KEY = (uid: string) => `seenCompletions_${uid}`;

interface MemberProfile {
  uid: string;
  displayName: string;
  photoURL?: string;
  xp: number;
}

function buildOverlay(q: Quest, uid: string, members: MemberProfile[]): QuestOverlayData {
  const questXp = q.xpReward || 100;
  const totalContributed = Object.values(q.contributions).reduce((s, v) => s + v, 0);
  const contributions = Object.entries(q.contributions).map(([cUid, contributed]) => {
    const member = members.find(m => m.uid === cUid);
    const pct = Math.round((contributed / (q.targetValue || totalContributed || 1)) * 100);
    const xpEarned =
      Math.floor(Math.min(contributed / (q.targetValue || 1), 1) * questXp * 0.5) +
      (cUid === q.topContributor ? Math.floor(questXp * 0.1) : 0);
    return {
      uid: cUid,
      displayName: member?.displayName || 'Unknown',
      photoURL: member?.photoURL,
      xp: member?.xp || 0,
      contributed,
      pct,
      xpEarned,
      isTop: cUid === q.topContributor,
      isMe: cUid === uid,
    };
  }).sort((a, b) => b.pct - a.pct);

  return { questTitle: q.title, unit: q.unit, targetValue: q.targetValue, totalXp: questXp, contributions };
}

export default function QuestCompletionWatcher({ uid }: { uid: string }) {
  const { pushOverlay } = useNotificationSheet();

  const check = useCallback(async () => {
    try {
      const seen: string[] = JSON.parse(localStorage.getItem(SEEN_KEY(uid)) || '[]');
      const cutoff = Date.now() - SEVEN_DAYS_MS;

      // Load user's groups — cache first, fallback to Firestore
      let groups: Group[] = readCache<Group[]>(`guildly_groups_${uid}`, []);
      if (!groups.length) {
        const snap = await getDocs(query(collection(db, 'groupMembers'), where('userId', '==', uid)));
        groups = snap.docs.map(d => ({ id: d.data().groupId } as Group));
      }

      const newSeen: string[] = [];
      const overlays: QuestOverlayData[] = [];

      for (const group of groups) {
        const groupId = group.id;

        // Load quests — cache first, fallback to Firestore
        let quests: Quest[] = readCache<Quest[]>(`guildly_quests_${groupId}`, []);
        if (!quests.length) {
          const qSnap = await getDocs(
            query(collection(db, 'groups', groupId, 'quests'), where('status', '==', 'completed'))
          );
          quests = qSnap.docs.map(d => ({ id: d.id, ...d.data() } as Quest));
        }

        const unseenCompleted = quests.filter(q => {
          if (q.status !== 'completed') return false;
          if (!q.contributions?.[uid]) return false;
          if (seen.includes(q.id)) return false;
          // Only show quests completed in the last 7 days
          const completedAt = q.completedAt
            ? (q.completedAt instanceof Date
                ? q.completedAt.getTime()
                : (q.completedAt as unknown as { seconds: number }).seconds * 1000)
            : null;
          if (!completedAt || completedAt < cutoff) return false;
          return true;
        });

        if (!unseenCompleted.length) continue;

        // Load member profiles for this group
        const memberSnap = await getDocs(
          query(collection(db, 'groupMembers'), where('groupId', '==', groupId))
        );
        const memberUids = memberSnap.docs.map(d => d.data().userId as string);
        const members: MemberProfile[] = await Promise.all(
          memberUids.map(async (mUid) => {
            const uSnap = await getDoc(doc(db, 'users', mUid));
            if (uSnap.exists()) {
              const d = uSnap.data();
              return { uid: mUid, displayName: d.displayName || 'Unknown', photoURL: d.photoURL, xp: d.xp || 0 };
            }
            return { uid: mUid, displayName: 'Unknown', xp: 0 };
          })
        );

        for (const q of unseenCompleted) {
          overlays.push(buildOverlay(q, uid, members));
          newSeen.push(q.id);
        }
      }

      if (!overlays.length) return;

      // Mark all seen upfront so re-renders don't re-queue
      localStorage.setItem(SEEN_KEY(uid), JSON.stringify([...seen, ...newSeen]));
      overlays.forEach(o => pushOverlay(o));
    } catch (e) {
      console.error('[QuestCompletionWatcher]', e);
    }
  }, [uid, pushOverlay]);

  useEffect(() => {
    if (!uid) return;
    check();
  }, [uid, check]);

  return null;
}
