'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import AppShell from '@/components/layout/AppShell';
import { useGroup, useGroupQuests, useGroupFeed, useGroupMembers } from '@/hooks/useGroup';
import FeedItem from '@/components/feed/FeedItem';
import ProgressBar from '@/components/ui/ProgressBar';
import UserAvatar from '@/components/ui/UserAvatar';
import QuestFormSheet, { questFormToFirestore } from '@/components/quests/QuestFormSheet';
import LogProgressModal from '@/components/quests/LogProgressModal';
import { xpToLevel } from '@/lib/utils';
import { Users, Crown, ArrowLeft, UserPlus, Share2, Trash2, Shield, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import {
  collection, addDoc, updateDoc, serverTimestamp, Timestamp, deleteDoc, doc,
  getDocs, query, where, getDoc, setDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Quest } from '@/types';
import { DIFFICULTY_LABELS } from '@/lib/questXp';

function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  const d = new Date(value as string | number);
  return isNaN(d.getTime()) ? null : d;
}

// Compact quest row with expand-on-tap
function CompactQuestRow({ quest, userId, groupId, onEdit }: {
  quest: Quest; userId: string; groupId: string; onEdit?: (q: Quest) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const pct = Math.min(100, Math.round((quest.currentValue / quest.targetValue) * 100));
  const deadlineDate = toDate(quest.deadline);
  const daysLeft = deadlineDate
    ? Math.max(0, Math.ceil((deadlineDate.getTime() - Date.now()) / 86400000))
    : null;
  const completed = quest.status === 'completed';

  return (
    <>
      <div className={`bg-white rounded-2xl border overflow-hidden ${completed ? 'border-green-200' : 'border-gray-100'}`}>
        <button className="w-full flex items-center gap-3 px-4 py-3 text-left" onClick={() => setExpanded(v => !v)}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-gray-900 truncate">{quest.title}</span>
              {completed && <span className="text-xs text-green-600 font-medium shrink-0">✓ Done</span>}
              {quest.difficulty && (
                <span className="text-xs text-gray-400 shrink-0">{DIFFICULTY_LABELS[quest.difficulty]}</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs text-gray-400 shrink-0">{pct}%</span>
              {daysLeft !== null && !completed && (
                <span className="text-xs text-gray-400 shrink-0">{daysLeft}d left</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!completed && (
              <button
                onClick={e => { e.stopPropagation(); setShowLog(true); }}
                className="w-8 h-8 bg-indigo-600 text-white rounded-xl flex items-center justify-center active:scale-95 transition-transform"
              >
                <Plus size={16} />
              </button>
            )}
            {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
          </div>
        </button>

        {expanded && (
          <div className="px-4 pb-4 border-t border-gray-50">
            <div className="flex items-center justify-between mt-3 mb-2">
              <span className="text-xs text-indigo-600 font-bold">+{quest.xpReward} XP</span>
              <span className="text-xs text-gray-500">My contribution: {quest.contributions?.[userId] || 0} {quest.unit}</span>
            </div>
            {quest.description && <p className="text-xs text-gray-500">{quest.description}</p>}
            {onEdit && (
              <button onClick={() => onEdit(quest)} className="mt-2 text-xs text-indigo-500 font-medium">
                Edit quest
              </button>
            )}
          </div>
        )}
      </div>

      {showLog && (
        <LogProgressModal quest={quest} userId={userId} groupId={groupId} onClose={() => setShowLog(false)} />
      )}
    </>
  );
}

export default function GroupDetailPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const { group } = useGroup(groupId);
  const { quests } = useGroupQuests(groupId);
  const { feed } = useGroupFeed(groupId);
  const { members: memberDocs } = useGroupMembers(groupId);

  const [sharing, setSharing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [userRole, setUserRole] = useState<'owner' | 'admin' | 'member' | null>(null);
  const [showQuestForm, setShowQuestForm] = useState(false);
  const [editingQuest, setEditingQuest] = useState<Quest | null>(null);

  const [memberProfiles, setMemberProfiles] = useState<{
    uid: string; displayName: string; photoURL?: string; xp: number; role: string;
  }[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  useEffect(() => {
    if (!user || !groupId) return;
    getDoc(doc(db, 'groupMembers', `${groupId}_${user.uid}`)).then(snap => {
      if (snap.exists()) setUserRole(snap.data().role as 'owner' | 'admin' | 'member');
    });
  }, [groupId, user]);

  useEffect(() => {
    if (memberDocs.length === 0) return;
    setLoadingMembers(true);
    Promise.all(memberDocs.map(async m => {
      const snap = await getDoc(doc(db, 'users', m.userId));
      const data = snap.exists() ? snap.data() : null;
      return { uid: m.userId, role: m.role, displayName: data?.displayName || 'Unknown', photoURL: data?.photoURL, xp: data?.xp || 0 };
    })).then(loaded => { setMemberProfiles(loaded); setLoadingMembers(false); });
  }, [memberDocs]);

  if (!group) return (
    <AppShell><div className="flex items-center justify-center h-64"><div className="text-3xl animate-pulse">⚡</div></div></AppShell>
  );

  const activeQuests = quests.filter(q => q.status === 'active');
  const completedQuests = quests.filter(q => q.status === 'completed');
  const { level, progress, nextLevelXp } = xpToLevel(group.xp || 0);
  const isOwner = userRole === 'owner';
  const isAdmin = userRole === 'owner' || userRole === 'admin';

  function getMemberQuestXp(uid: string): number {
    return quests.reduce((sum, q) => sum + (q.contributions?.[uid] || 0), 0);
  }

  async function handleInvite() {
    setSharing(true);
    try {
      const code = generateCode();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      await setDoc(doc(db, 'invites', code), {
        code, groupId, createdBy: user!.uid,
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(expiresAt),
        used: false,
      });
      const base = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
      const link = `${base}/join/${code}`;
      if (navigator.share) {
        await navigator.share({ title: `Join ${group?.name} on Guildly`, text: `Join "${group?.name}" on Guildly!`, url: link });
      } else {
        await navigator.clipboard.writeText(link);
        alert('Invite link copied!');
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') console.error(e);
    } finally { setSharing(false); }
  }

  async function handleDelete() {
    if (!isOwner || !confirm(`Delete "${group?.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      for (const sub of ['quests', 'feed']) {
        const snap = await getDocs(collection(db, 'groups', groupId, sub));
        await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
      }
      const invSnap = await getDocs(query(collection(db, 'invites'), where('groupId', '==', groupId)));
      await Promise.all(invSnap.docs.map(d => deleteDoc(d.ref)));
      const gmSnap = await getDocs(query(collection(db, 'groupMembers'), where('groupId', '==', groupId)));
      await Promise.all(gmSnap.docs.map(d => deleteDoc(d.ref)));
      await deleteDoc(doc(db, 'groups', groupId));
      router.replace('/groups');
    } catch (e) {
      console.error(e); alert('Failed to delete group.'); setDeleting(false);
    }
  }

  async function handleSaveQuest(data: ReturnType<typeof questFormToFirestore>) {
    if (editingQuest) {
      await updateDoc(doc(db, 'groups', groupId, 'quests', editingQuest.id), {
        title: data.title, description: data.description,
        targetValue: data.targetValue, unit: data.unit,
        difficulty: data.difficulty, duration: data.duration,
        deadline: data.deadline, xpReward: data.xpReward,
      });
    } else {
      await addDoc(collection(db, 'groups', groupId, 'quests'), {
        groupId,
        title: data.title, description: data.description,
        category: 'custom',
        targetValue: data.targetValue, unit: data.unit,
        difficulty: data.difficulty, duration: data.duration,
        currentValue: 0, contributions: {}, xpDeferred: {},
        status: 'active', xpReward: data.xpReward,
        deadline: data.deadline,
        createdAt: serverTimestamp(),
        createdBy: user!.uid,
      });
    }
  }

  function getRoleBadge(role: string) {
    if (role === 'owner') return (
      <span className="text-xs px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded-full font-medium flex items-center gap-0.5">
        <Crown size={9} /> Owner
      </span>
    );
    if (role === 'admin') return (
      <span className="text-xs px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-medium flex items-center gap-0.5">
        <Shield size={9} /> Admin
      </span>
    );
    return null;
  }

  return (
    <AppShell>
      <div className="px-4 pt-6 pb-8">

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
              <Users size={12} /> {memberDocs.length} members
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold text-indigo-600">Level {level}</div>
            <div className="text-xs text-gray-400">{group.xp || 0} XP</div>
          </div>
        </div>

        {/* XP bar */}
        <div className="mb-4">
          <ProgressBar value={progress} max={nextLevelXp} color="bg-gradient-to-r from-indigo-500 to-purple-500" />
          <p className="text-xs text-gray-400 mt-1 text-right">Group XP to Level {level + 1}</p>
        </div>

        {/* Admin actions */}
        {isAdmin && (
          <div className="flex gap-2 mb-5">
            <button onClick={handleInvite} disabled={sharing}
              className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50">
              {sharing ? '…' : <><UserPlus size={15} /><Share2 size={13} /> Invite</>}
            </button>
            <button onClick={() => { setEditingQuest(null); setShowQuestForm(true); }}
              className="flex-1 py-3 border border-indigo-200 text-indigo-600 rounded-2xl text-sm font-semibold flex items-center justify-center gap-1 active:scale-95 transition-transform">
              + Quest
            </button>
            {isOwner && (
              <button onClick={handleDelete} disabled={deleting}
                className="py-3 px-4 border border-red-200 text-red-400 rounded-2xl text-sm font-semibold flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50">
                {deleting ? '…' : <Trash2 size={16} />}
              </button>
            )}
          </div>
        )}

        {/* Members */}
        <div className="mb-5">
          <h2 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
            <Users size={15} className="text-indigo-500" /> Members ({memberDocs.length})
          </h2>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3">
            {loadingMembers ? (
              <p className="text-xs text-gray-400 text-center py-2">Loading…</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {memberProfiles.map(m => {
                  const questContrib = getMemberQuestXp(m.uid);
                  return (
                    <div key={m.uid} className="flex items-center gap-3 py-2.5">
                      <UserAvatar photoURL={m.photoURL} displayName={m.displayName} xp={m.xp} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-gray-800 truncate">{m.displayName}</span>
                          {getRoleBadge(m.role)}
                        </div>
                        {questContrib > 0 && (
                          <p className="text-xs text-indigo-500 font-medium">{questContrib} contributions</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-bold text-indigo-600">{m.xp} XP</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Active quests */}
        <div className="mb-5">
          <h2 className="font-bold text-gray-900 mb-2">Active Quests ({activeQuests.length})</h2>
          {activeQuests.length === 0 ? (
            <div className="bg-white rounded-2xl p-5 text-center border border-dashed border-gray-200">
              <p className="text-gray-400 text-sm">{isAdmin ? 'No active quests — tap "+ Quest" to add one' : 'No active quests yet'}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeQuests.map(q => (
                <CompactQuestRow key={q.id} quest={q} userId={user!.uid} groupId={groupId}
                  onEdit={isAdmin ? (q) => { setEditingQuest(q); setShowQuestForm(true); } : undefined}
                />
              ))}
            </div>
          )}
        </div>

        {/* Completed quests */}
        {completedQuests.length > 0 && (
          <div className="mb-5">
            <h2 className="font-bold text-gray-900 mb-2">Completed ✓</h2>
            <div className="space-y-2">
              {completedQuests.slice(0, 3).map(q => (
                <CompactQuestRow key={q.id} quest={q} userId={user!.uid} groupId={groupId} />
              ))}
            </div>
          </div>
        )}

        {/* Activity Feed */}
        <div className="mb-4">
          <h2 className="font-bold text-gray-900 mb-3">Activity Feed</h2>
          {feed.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">Nothing yet — log progress to get started!</p>
          ) : (
            <div className="bg-white rounded-3xl px-4 divide-y divide-gray-100 border border-gray-100">
              {feed.slice(0, 20).map(e => (
                <FeedItem key={e.id} entry={e}
                  members={memberProfiles}
                  quests={quests.map(q => ({ id: q.id, title: q.title }))}
                />
              ))}
            </div>
          )}
        </div>

      </div>

      {showQuestForm && (
        <QuestFormSheet
          editing={editingQuest}
          onClose={() => setShowQuestForm(false)}
          onSave={handleSaveQuest}
        />
      )}
    </AppShell>
  );
}
