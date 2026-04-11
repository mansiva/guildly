'use client';

import { use } from 'react';
import { useAuth } from '@/context/AuthContext';
import AppShell from '@/components/layout/AppShell';
import { useGroup, useGroupQuests, useGroupFeed } from '@/hooks/useGroup';
import QuestCard from '@/components/quests/QuestCard';
import FeedItem from '@/components/feed/FeedItem';
import ProgressBar from '@/components/ui/ProgressBar';
import { xpToLevel } from '@/lib/utils';
import { Users, Crown, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function GroupDetailPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = use(params);
  const { user } = useAuth();
  const { group } = useGroup(groupId);
  const { quests } = useGroupQuests(groupId);
  const { feed } = useGroupFeed(groupId);

  if (!group) return (
    <AppShell><div className="flex items-center justify-center h-64"><div className="text-3xl animate-pulse">⚡</div></div></AppShell>
  );

  const activeQuests = quests.filter(q => q.status === 'active');
  const completedQuests = quests.filter(q => q.status === 'completed');
  const { level, progress, nextLevelXp } = xpToLevel(group.xp || 0);
  const isAdmin = group.adminIds?.includes(user!.uid);

  return (
    <AppShell>
      <div className="px-4 pt-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/groups" className="p-2 rounded-full bg-gray-100">
            <ArrowLeft size={20} />
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{group.emoji}</span>
              <h1 className="text-xl font-bold text-gray-900">{group.name}</h1>
              {isAdmin && <Crown size={16} className="text-yellow-500" />}
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

        <div className="mb-6">
          <ProgressBar value={progress} max={nextLevelXp} color="bg-gradient-to-r from-indigo-500 to-purple-500" />
          <p className="text-xs text-gray-400 mt-1 text-right">Group XP to Level {level + 1}</p>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-900">Active Quests ({activeQuests.length})</h2>
            <Link href="/quests" className="text-sm text-indigo-600 font-medium">+ Quest</Link>
          </div>
          {activeQuests.length === 0 ? (
            <div className="bg-white rounded-3xl p-6 text-center border border-dashed border-gray-200">
              <p className="text-gray-400 text-sm">No active quests</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeQuests.map(q => <QuestCard key={q.id} quest={q} userId={user!.uid} groupId={groupId} />)}
            </div>
          )}
        </div>

        {completedQuests.length > 0 && (
          <div className="mb-6">
            <h2 className="font-bold text-gray-900 mb-3">Completed ✓</h2>
            <div className="space-y-2">
              {completedQuests.slice(0, 3).map(q => <QuestCard key={q.id} quest={q} userId={user!.uid} groupId={groupId} />)}
            </div>
          </div>
        )}

        <div className="mb-4">
          <h2 className="font-bold text-gray-900 mb-3">Activity Feed</h2>
          {feed.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">Nothing yet!</p>
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
