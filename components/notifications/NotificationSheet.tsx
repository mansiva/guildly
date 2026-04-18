'use client';

import { useEffect, useState, useCallback } from 'react';
import { collection, query, orderBy, limit, onSnapshot, doc, getDoc, getDocs, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { markAllRead } from '@/lib/notifications';
import { AppNotification, Quest } from '@/types';
import { X, Bell } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';
import { useNotificationSheet } from '@/context/NotificationContext';

interface Props {
  uid: string;
  open: boolean;
  onClose: () => void;
}

function notifIcon(type: AppNotification['type']) {
  switch (type) {
    case 'reaction': return null; // uses emoji field
    case 'quest_complete': return '🏆';
    case 'quest_failed': return '💀';
    case 'nudge': return '⚡';
  }
}

function notifText(n: AppNotification): string {
  switch (n.type) {
    case 'reaction':
      return `${n.fromName ?? 'Someone'} reacted ${n.emoji} to your log${n.questTitle ? ` on "${n.questTitle}"` : ''}`;
    case 'quest_complete':
      return `Quest "${n.questTitle}" was completed! 🎉`;
    case 'quest_failed':
      return `Quest "${n.questTitle}" ended without completion`;
    case 'nudge':
      return `${n.fromName ?? 'Someone'} nudged you ⚡`;
  }
}

export default function NotificationSheet({ uid, open, onClose }: Props) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const { pushOverlay, closeNotif } = useNotificationSheet();

  const handleQuestCompleteTap = useCallback(async (n: AppNotification) => {
    if (!n.questId || !n.groupId) return;
    try {
      // Fetch quest
      const qSnap = await getDoc(doc(db, 'groups', n.groupId, 'quests', n.questId));
      if (!qSnap.exists()) return;
      const quest = { id: qSnap.id, ...qSnap.data() } as Quest;

      // Fetch group members
      const memberSnap = await getDocs(query(collection(db, 'groupMembers'), where('groupId', '==', n.groupId)));
      const memberUids = memberSnap.docs.map(d => d.data().userId as string);
      const members = await Promise.all(
        memberUids.map(async (mUid) => {
          const uSnap = await getDoc(doc(db, 'users', mUid));
          const d = uSnap.exists() ? uSnap.data() : {};
          return { uid: mUid, displayName: d.displayName || 'Unknown', photoURL: d.photoURL, xp: d.xp || 0 };
        })
      );

      const questXp = quest.xpReward || 100;
      const totalContributed = Object.values(quest.contributions).reduce((s, v) => s + v, 0);
      const contributions = Object.entries(quest.contributions).map(([cUid, contributed]) => {
        const member = members.find(m => m.uid === cUid);
        const pct = Math.round((contributed / (quest.targetValue || totalContributed || 1)) * 100);
        const xpEarned =
          Math.floor(Math.min(contributed / (quest.targetValue || 1), 1) * questXp * 0.5) +
          (cUid === quest.topContributor ? Math.floor(questXp * 0.1) : 0);
        return {
          uid: cUid,
          displayName: member?.displayName || 'Unknown',
          photoURL: member?.photoURL,
          xp: member?.xp || 0,
          contributed: contributed as number,
          pct,
          xpEarned,
          isTop: cUid === quest.topContributor,
          isMe: cUid === uid,
        };
      }).sort((a, b) => b.pct - a.pct);

      closeNotif();
      pushOverlay({ questTitle: quest.title, unit: quest.unit, targetValue: quest.targetValue, totalXp: questXp, contributions });
    } catch (e) {
      console.error('[NotificationSheet] Failed to load quest overlay:', e);
    }
  }, [uid, pushOverlay, closeNotif]);

  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, 'notifications', uid, 'items'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const unsub = onSnapshot(q, snap => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as AppNotification)));
      setLoading(false);
    });
    return unsub;
  }, [uid]);

  // Mark all read when sheet opens
  useEffect(() => {
    if (open && uid) {
      markAllRead(uid);
    }
  }, [open, uid]);

  const unread = items.filter(n => !n.read);
  const hasItems = items.length > 0;

  return (
    <>
      {/* Backdrop */}
      {open && <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />}

      {/* Sheet */}
      <div
        className={`fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white rounded-t-3xl z-50 transition-transform duration-300 ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ maxHeight: '80vh' }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Bell size={18} className="text-indigo-500" />
            <h2 className="font-bold text-gray-900 text-base">Notifications</h2>
            {unread.length > 0 && (
              <span className="px-2 py-0.5 bg-indigo-600 text-white text-xs font-bold rounded-full">
                {unread.length}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full bg-gray-100">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {/* List */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(80vh - 100px)' }}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-2xl animate-pulse">⚡</div>
            </div>
          ) : !hasItems ? (
            <div className="text-center py-16 px-4">
              <div className="text-4xl mb-3">🔔</div>
              <p className="text-gray-500 text-sm">No notifications yet</p>
              <p className="text-gray-400 text-xs mt-1">Quest updates and reactions will appear here</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {items.map(n => {
                const icon = notifIcon(n.type);
                const time = n.createdAt instanceof Date
                  ? n.createdAt
                  : new Date(((n.createdAt as unknown as { seconds: number })?.seconds ?? 0) * 1000);
                return (
                  <div
                    key={n.id}
                    onClick={n.type === 'quest_complete' ? () => handleQuestCompleteTap(n) : undefined}
                    className={`flex items-start gap-3 px-5 py-3.5 ${!n.read ? 'bg-indigo-50/50' : ''} ${n.type === 'quest_complete' ? 'cursor-pointer active:bg-indigo-100/60' : ''}`}
                  >
                    <div className="w-9 h-9 rounded-2xl bg-indigo-100 flex items-center justify-center text-lg flex-shrink-0">
                      {n.type === 'reaction' ? n.emoji : icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 leading-snug">{notifText(n)}</p>
                      {n.groupName && (
                        <p className="text-xs text-gray-400 mt-0.5">{n.groupName}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">{formatRelativeTime(time)}</p>
                    </div>
                    {!n.read && (
                      <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div className="pb-8" />
        </div>
      </div>
    </>
  );
}
