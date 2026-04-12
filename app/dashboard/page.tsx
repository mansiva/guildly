'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import AppShell from '@/components/layout/AppShell';
import { useUserGroups, useGroupQuests, useGroupFeed } from '@/hooks/useGroup';
import QuestCard from '@/components/quests/QuestCard';
import FeedItem from '@/components/feed/FeedItem';
import ProgressBar from '@/components/ui/ProgressBar';
import UserAvatar from '@/components/ui/UserAvatar';
import { xpToLevel } from '@/lib/utils';
import { Group } from '@/types';
import Link from 'next/link';

export default function DashboardPage() {
  const { user } = useAuth();
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [userData, setUserData] = useState<{ xp: number; displayName: string } | null>(null);

  const { groups } = useUserGroups(user?.uid || null);
  const { quests } = useGroupQuests(activeGroupId);
  const { feed } = useGroupFeed(activeGroupId);

  const activeQuests = quests.filter(q => q.status === 'active');

  // Set default active group once groups load
  useEffect(() => {
    if (groups.length > 0 && !activeGroupId) {
      setActiveGroupId(groups[0].id);
    }
  }, [groups]);

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        setUserData({ xp: data.xp || 0, displayName: data.displayName });
      }
    });
  }, [user]);

  const { level, progress, nextLevelXp } = xpToLevel(userData?.xp || 0);

  return (
    <AppShell>
      <div className="px-4 pt-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <UserAvatar
            photoURL={user?.photoURL}
            displayName={userData?.displayName || user?.displayName}
            xp={userData?.xp}
            size="lg"
          />
          <div className="flex-1">
            <p className="text-gray-500 text-xs">Welcome back</p>
            <h1 className="text-xl font-bold text-gray-900">{userData?.displayName || user?.displayName} 👋</h1>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold text-indigo-600">Level {level}</div>
            <div className="text-xs text-gray-400">{userData?.xp || 0} XP</div>
          </div>
        </div>

        {/* XP bar */}
        <div className="mb-6">
          <ProgressBar value={progress} max={nextLevelXp} color="bg-gradient-to-r from-indigo-500 to-purple-500" />
          <p className="text-xs text-gray-400 mt-1 text-right">{progress} / {nextLevelXp} XP to Level {level + 1}</p>
        </div>

        {groups.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🚀</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Start your first quest</h2>
            <p className="text-gray-500 text-sm mb-6">Create a group and invite your crew to begin</p>
            <Link href="/groups" className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-2xl inline-block">
              Create a Group
            </Link>
          </div>
        ) : (
          <>
            {/* Group selector */}
            {groups.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
                {groups.map((g: Group) => (
                  <button
                    key={g.id}
                    onClick={() => setActiveGroupId(g.id)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      activeGroupId === g.id ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200'
                    }`}
                  >
                    {g.emoji} {g.name}
                  </button>
                ))}
              </div>
            )}

            {/* Active quests */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-gray-900">Active Quests</h2>
                <Link href="/quests" className="text-sm text-indigo-600 font-medium">See all</Link>
              </div>
              {activeQuests.length === 0 ? (
                <div className="bg-white rounded-3xl p-6 text-center border border-dashed border-gray-200">
                  <p className="text-gray-400 text-sm">No active quests</p>
                  <Link href="/quests" className="text-indigo-600 text-sm font-medium mt-1 inline-block">+ Add quest</Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeQuests.slice(0, 3).map(q => (
                    <QuestCard key={q.id} quest={q} userId={user!.uid} groupId={activeGroupId!} />
                  ))}
                </div>
              )}
            </div>

            {/* Feed */}
            <div className="mb-4">
              <h2 className="font-bold text-gray-900 mb-3">Group Activity</h2>
              {feed.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">No activity yet — be the first to log!</p>
              ) : (
                <div className="bg-white rounded-3xl px-4 divide-y divide-gray-100 border border-gray-100">
                  {feed.slice(0, 10).map(entry => (
                    <FeedItem key={entry.id} entry={entry} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
