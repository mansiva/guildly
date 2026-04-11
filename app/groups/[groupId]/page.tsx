'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import AppShell from '@/components/layout/AppShell';
import { useGroup, useGroupQuests, useGroupFeed } from '@/hooks/useGroup';
import QuestCard from '@/components/quests/QuestCard';
import FeedItem from '@/components/feed/FeedItem';
import ProgressBar from '@/components/ui/ProgressBar';
import { xpToLevel } from '@/lib/utils';
import { Users, Crown, ArrowLeft, UserPlus, Share2, Trash2 } from 'lucide-react';
import Link from 'next/link';
import {
  collection, addDoc, serverTimestamp, Timestamp, deleteDoc, doc, getDocs, query, where
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default function GroupDetailPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const { group } = useGroup(groupId);
  const { quests } = useGroupQuests(groupId);
  const { feed } = useGroupFeed(groupId);
  const [sharing, setSharing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!group) return (
    <AppShell><div className="flex items-center justify-center h-64"><div className="text-3xl animate-pulse">⚡</div></div></AppShell>
  );

  const activeQuests = quests.filter(q => q.status === 'active');
  const completedQuests = quests.filter(q => q.status === 'completed');
  const { level, progress, nextLevelXp } = xpToLevel(group.xp || 0);
  const isOwner = group.ownerId === user!.uid;
  const isAdmin = isOwner || group.adminIds?.includes(user!.uid);

  async function handleInvite() {
    setSharing(true);
    try {
      const code = generateCode();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      await addDoc(collection(db, 'invites'), {
        code,
        groupId,
        createdBy: user!.uid,
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(expiresAt),
        used: false,
      });
      const link = `${window.location.origin}/join/${code}`;
      const text = `Join my group "${group?.name}" on Guildly!`;
      if (navigator.share) {
        await navigator.share({ title: text, text, url: link });
      } else {
        await navigator.clipboard.writeText(link);
        alert('Invite link copied to clipboard!');
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') console.error(e);
    } finally {
      setSharing(false);
    }
  }

  async function handleDelete() {
    if (!isOwner) return;
    if (!confirm(`Delete "${group.name}"? This cannot be undone. All quests and data will be lost.`)) return;
    setDeleting(true);
    try {
      // Delete subcollections first (quests, feed)
      for (const sub of ['quests', 'feed']) {
        const snap = await getDocs(collection(db, 'groups', groupId, sub));
        await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
      }
      // Delete invites for this group
      const invSnap = await getDocs(query(collection(db, 'invites'), where('groupId', '==', groupId)));
      await Promise.all(invSnap.docs.map(d => deleteDoc(d.ref)));
      // Delete the group itself
      await deleteDoc(doc(db, 'groups', groupId));
      router.replace('/groups');
    } catch (e) {
      console.error(e);
      alert('Failed to delete group. Please try again.');
      setDeleting(false);
    }
  }

  return (
    <AppShell>
      <div className="px-4 pt-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <Link href="/groups" className="p-2 rounded-full bg-gray-100">
            <ArrowLeft size={20} className="text-gray-600" />
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{group.emoji}</span>
              <h1 className="text-xl font-bold text-gray-900">{group.name}</h1>
              {isOwner && <Crown size={16} className="text-yellow-500" />}
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Users size={12} /> {group.memberIds?.length || 0} members
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold text-indigo-600">Level {level}</div>
            <div className="text-xs text-gray-400">{group.xp || 0} XP</div>
          </div>
        </div>

        {/* Admin action bar */}
        {isAdmin && (
          <div className="flex gap-2 mb-5">
            <button onClick={handleInvite} disabled={sharing}
              className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50">
              {sharing ? '...' : <><UserPlus size={15} /><Share2 size={13} /> Invite</>}
            </button>
            {isAdmin && (
              <Link href="/quests"
                className="flex-1 py-3 border border-indigo-200 text-indigo-600 rounded-2xl text-sm font-semibold flex items-center justify-center gap-1 active:scale-95 transition-transform">
                + Quest
              </Link>
            )}
            {isOwner && (
              <button onClick={handleDelete} disabled={deleting}
                className="py-3 px-4 border border-red-200 text-red-400 rounded-2xl text-sm font-semibold flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50">
                {deleting ? '...' : <Trash2 size={16} />}
              </button>
            )}
          </div>
        )}

        {/* XP bar */}
        <div className="mb-6">
          <ProgressBar value={progress} max={nextLevelXp} color="bg-gradient-to-r from-indigo-500 to-purple-500" />
          <p className="text-xs text-gray-400 mt-1 text-right">Group XP to Level {level + 1}</p>
        </div>

        {/* Active quests */}
        <div className="mb-6">
          <h2 className="font-bold text-gray-900 mb-3">Active Quests ({activeQuests.length})</h2>
          {activeQuests.length === 0 ? (
            <div className="bg-white rounded-3xl p-6 text-center border border-dashed border-gray-200">
              <p className="text-gray-400 text-sm">{isAdmin ? 'No active quests — tap "+ Quest" to add one' : 'No active quests yet'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeQuests.map(q => <QuestCard key={q.id} quest={q} userId={user!.uid} groupId={groupId} />)}
            </div>
          )}
        </div>

        {/* Completed quests */}
        {completedQuests.length > 0 && (
          <div className="mb-6">
            <h2 className="font-bold text-gray-900 mb-3">Completed ✓</h2>
            <div className="space-y-2">
              {completedQuests.slice(0, 3).map(q => <QuestCard key={q.id} quest={q} userId={user!.uid} groupId={groupId} />)}
            </div>
          </div>
        )}

        {/* Feed */}
        <div className="mb-4">
          <h2 className="font-bold text-gray-900 mb-3">Activity Feed</h2>
          {feed.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">Nothing yet — complete a quest to get started!</p>
          ) : (
            <div className="bg-white rounded-3xl px-4 divide-y divide-gray-100 border border-gray-100">
              {feed.slice(0, 20).map(e => <FeedItem key={e.id} entry={e} />)}
            </div>
          )}
        </div>

      </div>
    </AppShell>
  );
}
