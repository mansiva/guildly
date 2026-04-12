'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import AppShell from '@/components/layout/AppShell';
import { useUserGroups, useGroupQuests, useGroupFeed, useGroupMembers, useGroupStats } from '@/hooks/useGroup';
import CompactQuestRow from '@/components/quests/CompactQuestRow';
import GroupCard from '@/components/groups/GroupCard';
import FeedItem from '@/components/feed/FeedItem';
import ProgressBar from '@/components/ui/ProgressBar';
import UserAvatar from '@/components/ui/UserAvatar';
import { xpToLevel } from '@/lib/utils';
import { Group, Quest } from '@/types';
import Link from 'next/link';
import QuestFormSheet, { questFormToFirestore } from '@/components/quests/QuestFormSheet';
import { updateDoc, doc as firestoreDoc } from 'firebase/firestore';

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  const d = new Date(value as string | number);
  return isNaN(d.getTime()) ? null : d;
}

// Hook to load quests for multiple groups at once
function useAllGroupsQuests(groupIds: string[]) {
  const g0 = useGroupQuests(groupIds[0] ?? null);
  const g1 = useGroupQuests(groupIds[1] ?? null);
  const g2 = useGroupQuests(groupIds[2] ?? null);
  const g3 = useGroupQuests(groupIds[3] ?? null);
  const g4 = useGroupQuests(groupIds[4] ?? null);

  const all: { quest: Quest; groupId: string }[] = [];
  [g0, g1, g2, g3, g4].forEach((g, i) => {
    const gid = groupIds[i];
    if (!gid) return;
    g.quests.filter(q => q.status === 'active').forEach(q => all.push({ quest: q, groupId: gid }));
  });

  // Sort by deadline ascending (soonest first), nulls last
  all.sort((a, b) => {
    const da = toDate(a.quest.deadline);
    const db_ = toDate(b.quest.deadline);
    if (!da && !db_) return 0;
    if (!da) return 1;
    if (!db_) return -1;
    return da.getTime() - db_.getTime();
  });

  return all;
}

// For the feed we just use the first group
export default function DashboardPage() {
  const { user } = useAuth();
  const [primaryGroupId, setPrimaryGroupId] = useState<string | null>(null);
  const [editingQuest, setEditingQuest] = useState<{ quest: Quest; groupId: string } | null>(null);
  const [userData, setUserData] = useState<{ xp: number; displayName: string } | null>(null);

  const { groups } = useUserGroups(user?.uid || null);
  const groupIds = groups.map(g => g.id);
  // Track which groups the user is admin/owner of
  const [adminGroupIds, setAdminGroupIds] = useState<Set<string>>(new Set());
  const groupStats = useGroupStats(groupIds);
  const allActiveQuests = useAllGroupsQuests(groupIds);
  const { feed } = useGroupFeed(primaryGroupId);
  const { members: memberDocs } = useGroupMembers(primaryGroupId);
  const [memberProfiles, setMemberProfiles] = useState<{ uid: string; displayName: string; photoURL?: string; xp: number }[]>([]);

  // Primary group for feed display
  useEffect(() => {
    if (groups.length > 0 && !primaryGroupId) setPrimaryGroupId(groups[0].id);
  }, [groups]);

  // Load admin/owner roles for all groups
  useEffect(() => {
    if (!user || groupIds.length === 0) return;
    Promise.all(groupIds.map(async gid => {
      const snap = await getDoc(firestoreDoc(db, 'groupMembers', `${gid}_${user.uid}`));
      return snap.exists() && ['owner', 'admin'].includes(snap.data().role) ? gid : null;
    })).then(results => {
      setAdminGroupIds(new Set(results.filter(Boolean) as string[]));
    });
  }, [groupIds.join(','), user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        setUserData({ xp: data.xp || 0, displayName: data.displayName });
      }
    });
  }, [user]);

  useEffect(() => {
    if (memberDocs.length === 0) return;
    Promise.all(memberDocs.map(async m => {
      const snap = await getDoc(doc(db, 'users', m.userId));
      const data = snap.exists() ? snap.data() : null;
      return { uid: m.userId, displayName: data?.displayName || 'Unknown', photoURL: data?.photoURL, xp: data?.xp || 0 };
    })).then(setMemberProfiles);
  }, [memberDocs]);

  const { level, progress, nextLevelXp } = xpToLevel(userData?.xp || 0);
  // Quests from primary group for feed lookup
  const primaryGroup = groups[0];

  return (
    <AppShell>
      <div className="px-4 pt-6 pb-4">
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
            {/* My Groups */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-gray-900">My Groups</h2>
                <Link href="/groups" className="text-sm text-indigo-600 font-medium">See all</Link>
              </div>
              <div className="space-y-3">
                {groups.map((g: Group) => (
                  <GroupCard
                    key={g.id}
                    group={g}
                    memberCount={groupStats[g.id]?.memberCount ?? 0}
                    activeQuestCount={groupStats[g.id]?.activeQuestCount ?? 0}
                  />
                ))}
              </div>
            </div>

            {/* Active quests — all groups, sorted by time left */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-gray-900">Active Quests</h2>
                <Link href="/quests" className="text-sm text-indigo-600 font-medium">See all</Link>
              </div>
              {allActiveQuests.length === 0 ? (
                <div className="bg-white rounded-2xl p-6 text-center border border-dashed border-gray-200">
                  <p className="text-gray-400 text-sm">No active quests</p>
                  <Link href="/quests" className="text-indigo-600 text-sm font-medium mt-1 inline-block">+ Add quest</Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {allActiveQuests.map(({ quest, groupId }) => {
                    const grp = groups.find(g => g.id === groupId);
                    return (
                      <CompactQuestRow
                        key={`${groupId}-${quest.id}`}
                        quest={quest}
                        userId={user!.uid}
                        groupId={groupId}
                        groupLabel={groups.length > 1 ? grp?.emoji : undefined}
                        onEdit={adminGroupIds.has(groupId) ? (q) => setEditingQuest({ quest: q, groupId }) : undefined}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {/* Feed — from primary group */}
            {feed.length > 0 && (
              <div className="mb-4">
                <h2 className="font-bold text-gray-900 mb-3">Recent Activity</h2>
                <div className="bg-white rounded-3xl px-4 divide-y divide-gray-100 border border-gray-100">
                  {feed.slice(0, 8).map(entry => (
                    <FeedItem
                      key={entry.id}
                      entry={entry}
                      members={memberProfiles}
                      quests={allActiveQuests.filter(a => a.groupId === primaryGroupId).map(a => ({ id: a.quest.id, title: a.quest.title }))}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {editingQuest && (
        <QuestFormSheet
          editing={editingQuest.quest}
          onClose={() => setEditingQuest(null)}
          onSave={async (data: ReturnType<typeof questFormToFirestore>) => {
            await updateDoc(firestoreDoc(db, 'groups', editingQuest.groupId, 'quests', editingQuest.quest.id), {
              title: data.title, description: data.description,
              targetValue: data.targetValue, unit: data.unit,
              difficulty: data.difficulty, duration: data.duration,
              deadline: data.deadline, xpReward: data.xpReward,
            });
          }}
        />
      )}
    </AppShell>
  );
}
