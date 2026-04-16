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
import { updateDoc, doc as firestoreDoc, addDoc, collection, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { Plus, UserPlus, Share2 } from 'lucide-react';

const GROUP_EMOJIS = ['🔥', '⚡', '🚀', '🎯', '💪', '🏆', '🌟', '🎮', '🧠', '❤️', '🌿', '🎨'];
function generateCode() { return Math.random().toString(36).substring(2, 8).toUpperCase(); }

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
function useAllGroupsQuests(groupIds: string[], userId: string | null) {
  const g0 = useGroupQuests(groupIds[0] ?? null, userId);
  const g1 = useGroupQuests(groupIds[1] ?? null, userId);
  const g2 = useGroupQuests(groupIds[2] ?? null, userId);
  const g3 = useGroupQuests(groupIds[3] ?? null, userId);
  const g4 = useGroupQuests(groupIds[4] ?? null, userId);

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
  const { user, loading: authLoading } = useAuth();
  const uid = authLoading ? null : (user?.uid ?? null);
  const [primaryGroupId, setPrimaryGroupId] = useState<string | null>(null);
  const [editingQuest, setEditingQuest] = useState<{ quest: Quest; groupId: string } | null>(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showJoinGroup, setShowJoinGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [groupEmoji, setGroupEmoji] = useState('🔥');
  const [joinCode, setJoinCode] = useState('');
  const [groupFormSaving, setGroupFormSaving] = useState(false);
  const [groupFormError, setGroupFormError] = useState('');
  const [userData, setUserData] = useState<{ xp: number; displayName: string } | null>(null);

  const { groups } = useUserGroups(uid);
  const groupIds = groups.map(g => g.id);
  // Track which groups the user is admin/owner of
  const [adminGroupIds, setAdminGroupIds] = useState<Set<string>>(new Set());
  const groupStats = useGroupStats(groupIds);
  const allActiveQuests = useAllGroupsQuests(groupIds, uid);
  const { feed } = useGroupFeed(primaryGroupId, uid);
  const { members: memberDocs } = useGroupMembers(primaryGroupId, uid);
  const [memberProfiles, setMemberProfiles] = useState<{ uid: string; displayName: string; photoURL?: string; xp: number }[]>([]);
  // Members per group for quest contributor lists
  const [membersByGroup, setMembersByGroup] = useState<Record<string, { uid: string; displayName: string; photoURL?: string }[]>>({});

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

  // Load members for all groups so quest contributor lists work across groups
  useEffect(() => {
    if (groupIds.length === 0) return;
    Promise.all(groupIds.map(async gid => {
      const { getDocs: gd, query: q2, collection: col, where: w } = await import('firebase/firestore');
      const snap = await gd(q2(col(db, 'groupMembers'), w('groupId', '==', gid)));
      const profiles = await Promise.all(snap.docs.map(async d => {
        const uid = d.data().userId as string;
        const usnap = await getDoc(firestoreDoc(db, 'users', uid));
        const data = usnap.exists() ? usnap.data() : null;
        return { uid, displayName: data?.displayName || 'Unknown', photoURL: data?.photoURL };
      }));
      return { gid, profiles };
    })).then(results => {
      const map: Record<string, { uid: string; displayName: string; photoURL?: string }[]> = {};
      results.forEach(r => { map[r.gid] = r.profiles; });
      setMembersByGroup(map);
    });
  }, [groupIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const { level, progress, nextLevelXp } = xpToLevel(userData?.xp || 0);

  async function createGroup() {
    if (!user || !groupName.trim()) return;
    setGroupFormSaving(true); setGroupFormError('');
    try {
      const ref = await addDoc(collection(db, 'groups'), {
        name: groupName.trim(), description: groupDesc.trim(),
        emoji: groupEmoji, maxMembers: 50, xp: 0, badges: [], createdAt: serverTimestamp(),
      });
      await setDoc(firestoreDoc(db, 'groupMembers', `${ref.id}_${user.uid}`), {
        groupId: ref.id, userId: user.uid, role: 'owner', joinedAt: serverTimestamp(),
      });
      setShowCreateGroup(false); setGroupName(''); setGroupDesc(''); setGroupEmoji('🔥');
    } catch (e: unknown) { setGroupFormError(e instanceof Error ? e.message : 'Failed'); }
    finally { setGroupFormSaving(false); }
  }

  async function joinGroup() {
    if (!user || !joinCode.trim()) return;
    setGroupFormSaving(true); setGroupFormError('');
    try {
      const { getDoc: gd, doc: fd, getDocs: gds, collection: col, query: q, where: wh, setDoc: sd } = await import('firebase/firestore');
      const invSnap = await gd(fd(db, 'invites', joinCode.trim().toUpperCase()));
      if (!invSnap.exists() || invSnap.data().used) { setGroupFormError('Invalid or used invite code'); setGroupFormSaving(false); return; }
      const invite = invSnap.data();
      const gid = invite.groupId;
      await sd(firestoreDoc(db, 'groupMembers', `${gid}_${user.uid}`), {
        groupId: gid, userId: user.uid, role: 'member', joinedAt: serverTimestamp(),
      });
      // Auto-friend existing members
      function fid(a: string, b: string) { return [a, b].sort().join('_'); }
      const membersSnap = await gds(q(col(db, 'groupMembers'), wh('groupId', '==', gid)));
      await Promise.all(membersSnap.docs.map(async d => {
        const otherUid = d.data().userId as string;
        if (otherUid === user.uid) return;
        const fsId = fid(user.uid, otherUid);
        const [a, b] = fsId.split('_');
        const fsSnap = await gd(fd(db, 'friendships', fsId));
        if (!fsSnap.exists() || fsSnap.data().status === 'removed') {
          await sd(fd(db, 'friendships', fsId), { userA: a, userB: b, initiator: 'group', status: 'accepted', createdAt: serverTimestamp() }, { merge: true });
        }
      }));
      setShowJoinGroup(false); setJoinCode('');
    } catch (e: unknown) { setGroupFormError(e instanceof Error ? e.message : 'Failed'); }
    finally { setGroupFormSaving(false); }
  }

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

        {/* Create / Join group CTAs — always visible */}
        <div className="flex gap-2 mb-6">
          <button onClick={() => { setShowCreateGroup(v => !v); setShowJoinGroup(false); setGroupFormError(''); }}
            className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-transform">
            <Plus size={16} /> New Group
          </button>
          <button onClick={() => { setShowJoinGroup(v => !v); setShowCreateGroup(false); setGroupFormError(''); }}
            className="flex-1 py-3 border border-indigo-200 text-indigo-600 rounded-2xl text-sm font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-transform">
            <UserPlus size={16} /> Join Group
          </button>
        </div>

        {/* Inline create form */}
        {showCreateGroup && (
          <div className="bg-white rounded-3xl p-4 mb-4 border border-indigo-100 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-3">Create Group</h3>
            <div className="flex gap-2 flex-wrap mb-3">
              {GROUP_EMOJIS.map(e => (
                <button key={e} onClick={() => setGroupEmoji(e)}
                  className={`text-2xl p-2 rounded-xl transition-all ${groupEmoji === e ? 'bg-indigo-100 scale-110' : 'hover:bg-gray-100'}`}>{e}</button>
              ))}
            </div>
            <input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Group name" maxLength={40}
              className="w-full px-4 py-3 bg-gray-50 text-gray-900 rounded-2xl text-sm mb-2 outline-none focus:ring-2 focus:ring-indigo-200" />
            <input value={groupDesc} onChange={e => setGroupDesc(e.target.value)} placeholder="Description (optional)" maxLength={100}
              className="w-full px-4 py-3 bg-gray-50 text-gray-900 rounded-2xl text-sm mb-3 outline-none focus:ring-2 focus:ring-indigo-200" />
            {groupFormError && <p className="text-red-500 text-xs mb-2">{groupFormError}</p>}
            <div className="flex gap-2">
              <button onClick={() => setShowCreateGroup(false)} className="flex-1 py-3 border border-gray-200 text-gray-700 rounded-2xl text-sm">Cancel</button>
              <button onClick={createGroup} disabled={groupFormSaving || !groupName.trim()}
                className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-semibold disabled:opacity-50">
                {groupFormSaving ? '…' : `Create ${groupEmoji}`}
              </button>
            </div>
          </div>
        )}

        {/* Inline join form */}
        {showJoinGroup && (
          <div className="bg-white rounded-3xl p-4 mb-4 border border-indigo-100 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-3">Join a Group</h3>
            <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} placeholder="INVITE CODE"
              maxLength={8} className="w-full px-4 py-3 bg-gray-50 text-gray-900 rounded-2xl text-sm mb-3 outline-none focus:ring-2 focus:ring-indigo-200 tracking-widest text-center font-mono text-lg uppercase" />
            {groupFormError && <p className="text-red-500 text-xs mb-2 text-center">{groupFormError}</p>}
            <div className="flex gap-2">
              <button onClick={() => setShowJoinGroup(false)} className="flex-1 py-3 border border-gray-200 text-gray-700 rounded-2xl text-sm">Cancel</button>
              <button onClick={joinGroup} disabled={groupFormSaving || !joinCode.trim()}
                className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-semibold disabled:opacity-50">
                {groupFormSaving ? '…' : 'Join'}
              </button>
            </div>
          </div>
        )}

        {groups.length === 0 && !showCreateGroup && !showJoinGroup ? (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">🚀</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Start your first quest</h2>
            <p className="text-gray-500 text-sm">Create a group and invite your crew to begin</p>
          </div>
        ) : (
          <>
            {/* My Groups */}
            {groups.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-bold text-gray-900">My Groups</h2>
                  <Link href="/groups" className="text-sm text-indigo-600 font-medium">See all</Link>
                </div>
                <div className="space-y-3">
                  {groups.map((g: Group) => (
                    <GroupCard key={g.id} group={g}
                      memberCount={groupStats[g.id]?.memberCount ?? 0}
                      activeQuestCount={groupStats[g.id]?.activeQuestCount ?? 0}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Active quests — all groups, sorted by time left */}
            {groups.length > 0 && (
              <div className="mb-6">
                <h2 className="font-bold text-gray-900 mb-3">Active Quests</h2>
                {allActiveQuests.length === 0 ? (
                  <div className="bg-white rounded-2xl p-6 text-center border border-dashed border-gray-200">
                    <p className="text-gray-400 text-sm">No active quests — open a group to add one</p>
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
                          groupLabel={grp ? `${grp.emoji} ${grp.name}` : undefined}
                          members={membersByGroup[groupId] || []}
                          onEdit={adminGroupIds.has(groupId) ? (q) => setEditingQuest({ quest: q, groupId }) : undefined}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Feed — from primary group */}
            {feed.length > 0 && (
              <div className="mb-4">
                <h2 className="font-bold text-gray-900 mb-3">Recent Activity</h2>
                <div className="bg-white rounded-3xl px-4 divide-y divide-gray-100 border border-gray-100">
                  {feed.slice(0, 8).map(entry => (
                    <FeedItem key={entry.id} entry={entry}
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
