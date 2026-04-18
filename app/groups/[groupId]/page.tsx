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
import CompactQuestRow from '@/components/quests/CompactQuestRow';
import { xpToLevel } from '@/lib/utils';
import { Users, Crown, ArrowLeft, UserPlus, UserCheck, Share2, Trash2, Shield, ChevronRight, X, LogOut, Zap, Pencil } from 'lucide-react';
import Link from 'next/link';
import {
  collection, addDoc, updateDoc, serverTimestamp, Timestamp, deleteDoc, doc,
  getDocs, query, where, getDoc, setDoc, Timestamp as FsTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Quest } from '@/types';


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


export default function GroupDetailPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const uid = authLoading ? null : (user?.uid ?? null);
  const { group, error: groupError } = useGroup(groupId, uid);
  const { quests } = useGroupQuests(groupId, uid);
  const { feed } = useGroupFeed(groupId, uid);
  const { members: memberDocs } = useGroupMembers(groupId, uid);

  const [sharing, setSharing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [userRole, setUserRole] = useState<'owner' | 'admin' | 'member' | null>(null);
  const [showQuestForm, setShowQuestForm] = useState(false);
  const [editingQuest, setEditingQuest] = useState<Quest | null>(null);
  const [managingMember, setManagingMember] = useState<typeof memberProfiles[0] | null>(null);
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());
  const [followToggling, setFollowToggling] = useState<string | null>(null);
  // nudgeStatus: tracks per-recipient whether sender has recently nudged them
  const [nudgeStatuses, setNudgeStatuses] = useState<Record<string, 'ok' | 'limited' | 'sending'>>({});


  const [memberProfiles, setMemberProfiles] = useState<{
    uid: string; displayName: string; photoURL?: string; xp: number; xpInGroup: number; role: string; fcmToken?: string;
  }[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  useEffect(() => {
    if (!user || !groupId) return;
    getDoc(doc(db, 'groupMembers', `${groupId}_${user.uid}`)).then(snap => {
      if (snap.exists()) setUserRole(snap.data().role as 'owner' | 'admin' | 'member');
    });
  }, [groupId, user]);

  useEffect(() => {
    if (memberDocs.length === 0 || !user?.uid) return;
    const myUid = user.uid;
    setLoadingMembers(true);
    async function load() {
      const activeDocs = memberDocs.filter(m => m.status !== 'removed');
      const loaded = await Promise.all(activeDocs.map(async m => {
        const snap = await getDoc(doc(db, 'users', m.userId));
        const data = snap.exists() ? snap.data() : null;
        return { uid: m.userId, role: m.role, displayName: data?.displayName || 'Unknown', photoURL: data?.photoURL, xp: data?.xp || 0, xpInGroup: m.xpInGroup || 0, fcmToken: data?.fcmToken };
      }));
      setMemberProfiles(loaded);
      setLoadingMembers(false);
      // Load follow statuses
      const followSnap = await getDocs(query(collection(db, 'follows'), where('followerId', '==', myUid)));
      setFollowingSet(new Set(followSnap.docs.map(d => d.data().followeeId as string)));

      // Check nudge rate limits client-side (6h window)
      const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
      const nudges: Record<string, 'ok' | 'limited' | 'sending'> = {};
      await Promise.all(loaded.filter(m => m.uid !== myUid).map(async m => {
        const nudgeSnap = await getDoc(doc(db, 'nudges', `${myUid}_${m.uid}`));
        if (nudgeSnap.exists()) {
          const lastSentAt = (nudgeSnap.data().lastSentAt as FsTimestamp | null)?.toMillis?.() ?? 0;
          nudges[m.uid] = Date.now() - lastSentAt < SIX_HOURS_MS ? 'limited' : 'ok';
        } else {
          nudges[m.uid] = 'ok';
        }
      }));
      setNudgeStatuses(nudges);
    }
    load().catch(console.error);
  }, [memberDocs, user?.uid]);

  useEffect(() => {
    if (groupError) router.replace('/groups');
  }, [groupError, router]);

  if (!group || !user) return (
    <AppShell><div className="flex items-center justify-center h-64"><div className="text-3xl animate-pulse">⚡</div></div></AppShell>
  );

  function sortByDeadline(list: typeof quests) {
    return [...list].sort((a, b) => {
      const da = toDate(a.deadline);
      const db_ = toDate(b.deadline);
      if (!da && !db_) return 0;
      if (!da) return 1;
      if (!db_) return -1;
      return da.getTime() - db_.getTime();
    });
  }
  const activeQuests = sortByDeadline(quests.filter(q => q.status === 'active'));
  const completedQuests = quests.filter(q => q.status === 'completed');
  const { level, progress, nextLevelXp } = xpToLevel(group.xp || 0);
  const isOwner = userRole === 'owner';
  const isAdmin = userRole === 'owner' || userRole === 'admin';



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

  async function handleFollowToggle(toUid: string) {
    if (!user) return;
    setFollowToggling(toUid);
    try {
      if (followingSet.has(toUid)) {
        await deleteDoc(doc(db, 'follows', `${user.uid}_${toUid}`));
        setFollowingSet(prev => { const s = new Set(prev); s.delete(toUid); return s; });
      } else {
        await setDoc(doc(db, 'follows', `${user.uid}_${toUid}`), {
          followerId: user.uid, followeeId: toUid, createdAt: serverTimestamp(),
        });
        setFollowingSet(prev => new Set([...prev, toUid]));
      }
    } finally { setFollowToggling(null); }
  }

  async function handleNudge(recipientUid: string) {
    if (!user || !group) return;
    setNudgeStatuses(prev => ({ ...prev, [recipientUid]: 'sending' }));
    try {
      const res = await fetch('/api/nudge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: user.uid,
          recipientId: recipientUid,
          groupId,
          groupName: group.name,
        }),
      });
      if (res.ok) {
        setNudgeStatuses(prev => ({ ...prev, [recipientUid]: 'limited' }));
      } else {
        const data = await res.json();
        if (data.rateLimited) {
          setNudgeStatuses(prev => ({ ...prev, [recipientUid]: 'limited' }));
        } else {
          setNudgeStatuses(prev => ({ ...prev, [recipientUid]: 'ok' }));
          console.error('[Nudge] Failed:', data.error);
        }
      }
    } catch (err) {
      setNudgeStatuses(prev => ({ ...prev, [recipientUid]: 'ok' }));
      console.error('[Nudge] Error:', err);
    }
  }

  async function handlePromote(uid: string) {
    await updateDoc(doc(db, 'groupMembers', `${groupId}_${uid}`), { role: 'admin' });
    setManagingMember(null);
  }

  async function handleDemote(uid: string) {
    await updateDoc(doc(db, 'groupMembers', `${groupId}_${uid}`), { role: 'member' });
    setManagingMember(null);
  }

  async function handleRemoveMember(uid: string) {
    if (!confirm('Remove this member from the group? Their contributions to active quests are kept and they will still receive XP if a quest they contributed to completes.')) return;
    await updateDoc(doc(db, 'groupMembers', `${groupId}_${uid}`), { status: 'removed' });
    setManagingMember(null);
  }

  async function handleLeaveGroup() {
    if (!user || !confirm('Leave this group? Your progress will be kept but you won\'t be able to see it anymore.')) return;
    await deleteDoc(doc(db, 'groupMembers', `${groupId}_${user.uid}`));
    router.replace('/dashboard');
  }

  async function handleSaveQuest(data: ReturnType<typeof questFormToFirestore>) {
    if (editingQuest) {
      const hasContributions = Object.keys(editingQuest.contributions ?? {}).length > 0;
      if (hasContributions) {
        alert('This quest already has contributions and cannot be edited.');
        return;
      }
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
        originalDeadline: data.deadline,
        renewalCount: 0,
        bonusXpMultiplier: 1.0,
        repeat: data.repeat ?? false,
        repeatSpawned: false,
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
        <div className="flex gap-2 mb-5">
          {isAdmin && (
            <>
              <button onClick={handleInvite} disabled={sharing}
                className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50">
                {sharing ? '…' : <><UserPlus size={15} /><Share2 size={13} /> Invite</>}
              </button>
              <button onClick={() => { setEditingQuest(null); setShowQuestForm(true); }}
                className="flex-1 py-3 border border-indigo-200 text-indigo-600 rounded-2xl text-sm font-semibold flex items-center justify-center gap-1 active:scale-95 transition-transform">
                + Quest
              </button>
            </>
          )}
          {isOwner ? (
            <button onClick={handleDelete} disabled={deleting}
              className="py-3 px-4 border border-red-200 text-red-400 rounded-2xl text-sm font-semibold flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50">
              {deleting ? '…' : <Trash2 size={16} />}
            </button>
          ) : (
            <button onClick={handleLeaveGroup}
              className="py-3 px-4 border border-red-200 text-red-400 rounded-2xl text-sm font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-transform">
              <LogOut size={15} /> Leave
            </button>
          )}
        </div>

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
                  const manageable = isAdmin && m.role !== 'owner' && m.uid !== user?.uid;
                  const isOtherUser = m.uid !== user?.uid;
                  return (
                    <div
                      key={m.uid}
                      className={`flex items-center gap-3 py-2.5 ${isOtherUser ? 'cursor-pointer active:bg-gray-50 rounded-xl -mx-1 px-1' : ''}`}
                      onClick={() => { if (isOtherUser) router.push(`/profile/${m.uid}`); }}
                    >
                      <UserAvatar photoURL={m.photoURL} displayName={m.displayName} xp={m.xp} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-gray-800 truncate">{m.displayName}</span>
                          {getRoleBadge(m.role)}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-indigo-500 font-medium">{m.xpInGroup} xp</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {m.uid !== user?.uid && m.fcmToken && (() => {
                          const ns = nudgeStatuses[m.uid];
                          const isLimited = ns === 'limited';
                          const isSending = ns === 'sending';
                          return (
                            <button
                              onClick={e => { e.stopPropagation(); if (!isLimited && !isSending) handleNudge(m.uid); }}
                              disabled={isLimited || isSending}
                              title={isLimited ? 'Already nudged recently' : 'Nudge to log progress'}
                              className={`p-1.5 rounded-lg transition-transform ${
                                isLimited
                                  ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                                  : isSending
                                  ? 'bg-amber-50 text-amber-300 cursor-wait'
                                  : 'bg-amber-50 text-amber-500 active:scale-95'
                              }`}
                            >
                              <Zap size={13} />
                            </button>
                          );
                        })()}
                        {m.uid !== user?.uid && !followingSet.has(m.uid) && (
                          <button
                            onClick={e => { e.stopPropagation(); handleFollowToggle(m.uid); }}
                            disabled={followToggling === m.uid}
                            title="Follow"
                            className="p-1.5 rounded-lg transition-transform active:scale-95 disabled:opacity-50 bg-gray-50 text-gray-400 hover:bg-indigo-50 hover:text-indigo-500"
                          >
                            <UserPlus size={13} />
                          </button>
                        )}
                        {manageable && (
                          <button
                            onClick={e => { e.stopPropagation(); setManagingMember(m); }}
                            className="p-1.5 rounded-lg bg-gray-50 text-gray-400 hover:bg-gray-100 active:scale-95 transition-transform"
                            title="Manage member"
                          >
                            <Pencil size={13} />
                          </button>
                        )}
                        {isOtherUser && <ChevronRight size={14} className="text-gray-300" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {isAdmin && <p className="text-xs text-gray-400 text-center mt-1.5">Tap to view profile · ✏️ to manage role</p>}
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
                  members={memberProfiles}
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
                <CompactQuestRow key={q.id} quest={q} userId={user!.uid} groupId={groupId} members={memberProfiles} />
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
                  quests={quests.map(q => ({ id: q.id, title: q.title, unit: q.unit }))}
                  groupId={groupId}
                  groupName={group?.name}
                  currentUserId={user?.uid}
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

      {/* Member management action sheet (owner only) */}
      {managingMember && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-end" onClick={() => setManagingMember(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full max-w-[480px] bg-white rounded-t-3xl px-4 overflow-y-auto pb-16"
            onClick={e => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-4" />

            {/* Member info */}
            <div className="flex items-center gap-3 mb-5">
              <UserAvatar photoURL={managingMember.photoURL} displayName={managingMember.displayName} xp={managingMember.xp} size="md" />
              <div>
                <p className="font-semibold text-gray-900">{managingMember.displayName}</p>
                <p className="text-xs text-gray-400 capitalize">{managingMember.role}</p>
              </div>
              <button onClick={() => setManagingMember(null)} className="ml-auto p-2 text-gray-400">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2">
              {isOwner && (managingMember.role === 'member' ? (
                <button
                  onClick={() => handlePromote(managingMember.uid)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 bg-indigo-50 text-indigo-700 rounded-2xl font-medium text-sm active:scale-[0.98] transition-transform"
                >
                  <Shield size={18} />
                  Make Admin
                  <span className="ml-auto text-xs text-indigo-400">Can edit quests</span>
                </button>
              ) : (
                <button
                  onClick={() => handleDemote(managingMember.uid)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 bg-gray-50 text-gray-700 rounded-2xl font-medium text-sm active:scale-[0.98] transition-transform"
                >
                  <Shield size={18} className="text-gray-400" />
                  Remove Admin
                  <span className="ml-auto text-xs text-gray-400">Revert to member</span>
                </button>
              ))}
              <button
                onClick={() => handleRemoveMember(managingMember.uid)}
                className="w-full flex items-center gap-3 px-4 py-3.5 bg-red-50 text-red-600 rounded-2xl font-medium text-sm active:scale-[0.98] transition-transform"
              >
                <Trash2 size={18} />
                Remove from group
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
