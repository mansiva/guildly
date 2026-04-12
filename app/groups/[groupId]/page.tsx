'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import AppShell from '@/components/layout/AppShell';
import { useGroup, useGroupQuests, useGroupFeed, useGroupMembers } from '@/hooks/useGroup';
import QuestCard from '@/components/quests/QuestCard';
import FeedItem from '@/components/feed/FeedItem';
import ProgressBar from '@/components/ui/ProgressBar';
import { xpToLevel } from '@/lib/utils';
import { Users, Crown, ArrowLeft, UserPlus, Share2, Trash2, X, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import UserAvatar from '@/components/ui/UserAvatar';
import Link from 'next/link';
import {
  collection, addDoc, updateDoc, serverTimestamp, Timestamp, deleteDoc, doc,
  getDocs, query, where, getDoc, setDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Quest } from '@/types';

function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

const XP_OPTIONS = [50, 100, 250, 500];
const UNIT_OPTIONS = ['sessions', 'km', 'miles', 'pages', 'minutes', 'hours', 'reps', 'items', 'days'];

interface QuestForm {
  title: string;
  description: string;
  targetValue: string;
  unit: string;
  customUnit: string;
  xpReward: number | 'custom';
  customXp: string;
  deadline: string;
}

const EMPTY_FORM: QuestForm = {
  title: '',
  description: '',
  targetValue: '',
  unit: 'sessions',
  customUnit: '',
  xpReward: 100,
  customXp: '',
  deadline: '',
};

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
  const [questForm, setQuestForm] = useState<QuestForm>(EMPTY_FORM);
  const [savingQuest, setSavingQuest] = useState(false);
  const [questError, setQuestError] = useState('');

  // Members display
  const [memberProfiles, setMemberProfiles] = useState<{ uid: string; displayName: string; photoURL?: string; xp: number; role: string }[]>([]);
  const [showMembers, setShowMembers] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);

  useEffect(() => {
    if (!user || !groupId) return;
    getDoc(doc(db, 'groupMembers', `${groupId}_${user.uid}`)).then(snap => {
      if (snap.exists()) setUserRole(snap.data().role as 'owner' | 'admin' | 'member');
    });
  }, [groupId, user]);

  async function loadMemberProfiles() {
    if (memberProfiles.length > 0) return; // already loaded
    setLoadingMembers(true);
    try {
      const loaded = await Promise.all(memberDocs.map(async m => {
        const snap = await getDoc(doc(db, 'users', m.userId));
        const data = snap.exists() ? snap.data() : null;
        return {
          uid: m.userId,
          role: m.role,
          displayName: data?.displayName || 'Unknown',
          photoURL: data?.photoURL || undefined,
          xp: data?.xp || 0,
        };
      }));
      setMemberProfiles(loaded);
    } finally { setLoadingMembers(false); }
  }

  function handleToggleMembers() {
    if (!showMembers) loadMemberProfiles();
    setShowMembers(v => !v);
  }

  if (!group) return (
    <AppShell><div className="flex items-center justify-center h-64"><div className="text-3xl animate-pulse">⚡</div></div></AppShell>
  );

  const activeQuests = quests.filter(q => q.status === 'active');
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
      const title = `Join ${group?.name} on Guildly`;
      const text = `You've been invited to join "${group?.name}" on Guildly. Tap the link to join!`;
      if (navigator.share) {
        await navigator.share({ title, text, url: link });
      } else {
        await navigator.clipboard.writeText(link);
        alert('Invite link copied to clipboard!');
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') console.error(e);
    } finally { setSharing(false); }
  }

  async function handleDelete() {
    if (!isOwner) return;
    if (!confirm(`Delete "${group?.name}"? This cannot be undone.`)) return;
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
      console.error(e);
      alert('Failed to delete group.');
      setDeleting(false);
    }
  }

  function openCreateQuest() {
    setEditingQuest(null);
    setQuestForm(EMPTY_FORM);
    setQuestError('');
    setShowQuestForm(true);
  }

  function openEditQuest(quest: Quest) {
    setEditingQuest(quest);
    let deadlineStr = '';
    if (quest.deadline) {
      const d = typeof quest.deadline === 'object' && 'toDate' in quest.deadline
        ? (quest.deadline as unknown as { toDate: () => Date }).toDate()
        : new Date(quest.deadline as unknown as string);
      if (!isNaN(d.getTime())) deadlineStr = d.toISOString().split('T')[0];
    }
    setQuestForm({
      title: quest.title,
      description: quest.description || '',
      targetValue: String(quest.targetValue),
      unit: UNIT_OPTIONS.includes(quest.unit) ? quest.unit : 'custom',
      customUnit: UNIT_OPTIONS.includes(quest.unit) ? '' : quest.unit,
      xpReward: XP_OPTIONS.includes(quest.xpReward) ? quest.xpReward : 'custom',
      customXp: XP_OPTIONS.includes(quest.xpReward) ? '' : String(quest.xpReward),
      deadline: deadlineStr,
    });
    setQuestError('');
    setShowQuestForm(true);
  }

  async function handleSaveQuest() {
    if (!questForm.title.trim()) { setQuestError('Quest name is required'); return; }
    if (!questForm.targetValue || Number(questForm.targetValue) <= 0) { setQuestError('Set a goal amount'); return; }
    setSavingQuest(true); setQuestError('');
    try {
      const unit = questForm.unit === 'custom' ? questForm.customUnit.trim() || 'items' : questForm.unit;
      const xpReward = questForm.xpReward === 'custom' ? Number(questForm.customXp) || 100 : questForm.xpReward;
      const deadline = questForm.deadline ? Timestamp.fromDate(new Date(questForm.deadline)) : null;

      if (editingQuest) {
        await updateDoc(doc(db, 'groups', groupId, 'quests', editingQuest.id), {
          title: questForm.title.trim(),
          description: questForm.description.trim(),
          targetValue: Number(questForm.targetValue),
          unit,
          xpReward,
          deadline,
        });
      } else {
        await addDoc(collection(db, 'groups', groupId, 'quests'), {
          groupId,
          title: questForm.title.trim(),
          description: questForm.description.trim(),
          category: 'custom',
          targetValue: Number(questForm.targetValue),
          unit,
          currentValue: 0,
          contributions: {},
          status: 'active',
          xpReward,
          deadline,
          createdAt: serverTimestamp(),
          createdBy: user!.uid,
        });
      }
      setShowQuestForm(false);
      setEditingQuest(null);
      setQuestForm(EMPTY_FORM);
    } catch (e) {
      console.error(e);
      setQuestError('Failed to save quest. Try again.');
    } finally { setSavingQuest(false); }
  }

  function getRoleBadge(role: string) {
    if (role === 'owner') return (
      <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full font-medium flex items-center gap-1">
        <Crown size={10} /> Owner
      </span>
    );
    if (role === 'admin') return (
      <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-medium flex items-center gap-1">
        <Shield size={10} /> Admin
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

        {/* Admin action bar */}
        {isAdmin && (
          <div className="flex gap-2 mb-5">
            <button onClick={handleInvite} disabled={sharing}
              className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50">
              {sharing ? '...' : <><UserPlus size={15} /><Share2 size={13} /> Invite</>}
            </button>
            <button onClick={openCreateQuest}
              className="flex-1 py-3 border border-indigo-200 text-indigo-600 rounded-2xl text-sm font-semibold flex items-center justify-center gap-1 active:scale-95 transition-transform">
              + Quest
            </button>
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

        {/* Members section */}
        <div className="mb-6">
          <button
            onClick={handleToggleMembers}
            className="w-full flex items-center justify-between py-3 px-4 bg-white rounded-2xl border border-gray-100 shadow-sm"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Users size={16} className="text-indigo-500" />
              Members ({memberDocs.length})
            </div>
            {showMembers ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
          </button>

          {showMembers && (
            <div className="mt-2 bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3">
              {loadingMembers ? (
                <p className="text-xs text-gray-400 text-center py-2">Loading...</p>
              ) : memberProfiles.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-2">No members found</p>
              ) : (
                <div className="space-y-3">
                  {memberProfiles.map(m => (
                    <div key={m.uid} className="flex items-center gap-3">
                      <UserAvatar
                        photoURL={m.photoURL}
                        displayName={m.displayName}
                        xp={m.xp}
                        size="sm"
                      />
                      <span className="text-sm font-medium text-gray-800 flex-1">{m.displayName}</span>
                      {getRoleBadge(m.role)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
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
              {activeQuests.map(q => (
                <QuestCard
                  key={q.id}
                  quest={q}
                  userId={user!.uid}
                  groupId={groupId}
                  onEdit={isAdmin ? openEditQuest : undefined}
                />
              ))}
            </div>
          )}
        </div>

        {/* Completed quests */}
        {completedQuests.length > 0 && (
          <div className="mb-6">
            <h2 className="font-bold text-gray-900 mb-3">Completed ✓</h2>
            <div className="space-y-2">
              {completedQuests.slice(0, 3).map(q => (
                <QuestCard
                  key={q.id}
                  quest={q}
                  userId={user!.uid}
                  groupId={groupId}
                />
              ))}
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

      {/* Quest form bottom sheet */}
      {showQuestForm && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowQuestForm(false)} />
          <div className="relative w-full max-w-[480px] bg-white rounded-t-3xl px-5 pt-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">
                {editingQuest ? 'Edit Quest' : 'New Quest'}
              </h2>
              <button onClick={() => setShowQuestForm(false)} className="p-2 rounded-full bg-gray-100">
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Quest Name *</label>
                <input
                  value={questForm.title}
                  onChange={e => setQuestForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Run 5km every day"
                  maxLength={60}
                  className="w-full px-4 py-3 bg-gray-50 text-gray-900 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                  Description <span className="normal-case font-normal">(optional)</span>
                </label>
                <textarea
                  value={questForm.description}
                  onChange={e => setQuestForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="What needs to be done?"
                  maxLength={200}
                  rows={2}
                  className="w-full px-4 py-3 bg-gray-50 text-gray-900 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-200 resize-none"
                />
              </div>

              {/* Goal */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Goal *</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={questForm.targetValue}
                    onChange={e => setQuestForm(f => ({ ...f, targetValue: e.target.value }))}
                    placeholder="30"
                    min="1"
                    className="w-28 px-4 py-3 bg-gray-50 text-gray-900 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                  <select
                    value={questForm.unit}
                    onChange={e => setQuestForm(f => ({ ...f, unit: e.target.value }))}
                    className="flex-1 px-4 py-3 bg-gray-50 text-gray-900 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-200"
                  >
                    {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                    <option value="custom">custom...</option>
                  </select>
                </div>
                {questForm.unit === 'custom' && (
                  <input
                    value={questForm.customUnit}
                    onChange={e => setQuestForm(f => ({ ...f, customUnit: e.target.value }))}
                    placeholder="e.g. chapters, workouts"
                    className="w-full mt-2 px-4 py-3 bg-gray-50 text-gray-900 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                )}
              </div>

              {/* XP Reward */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">XP Reward</label>
                <div className="flex gap-2 flex-wrap">
                  {XP_OPTIONS.map(xp => (
                    <button key={xp}
                      onClick={() => setQuestForm(f => ({ ...f, xpReward: xp }))}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${questForm.xpReward === xp ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                      {xp} XP
                    </button>
                  ))}
                  <button
                    onClick={() => setQuestForm(f => ({ ...f, xpReward: 'custom' }))}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${questForm.xpReward === 'custom' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                    Custom
                  </button>
                </div>
                {questForm.xpReward === 'custom' && (
                  <input
                    type="number"
                    value={questForm.customXp}
                    onChange={e => setQuestForm(f => ({ ...f, customXp: e.target.value }))}
                    placeholder="e.g. 750"
                    min="1"
                    className="w-full mt-2 px-4 py-3 bg-gray-50 text-gray-900 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                )}
              </div>

              {/* Deadline */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                  Deadline <span className="normal-case font-normal">(optional)</span>
                </label>
                <input
                  type="date"
                  value={questForm.deadline}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => setQuestForm(f => ({ ...f, deadline: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-50 text-gray-900 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>

              {questError && <p className="text-red-500 text-sm text-center">{questError}</p>}

              <button
                onClick={handleSaveQuest}
                disabled={savingQuest || !questForm.title.trim() || !questForm.targetValue}
                className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl text-sm active:scale-95 transition-transform disabled:opacity-50 mt-2"
              >
                {savingQuest ? 'Saving...' : editingQuest ? 'Save Changes' : '⚡ Create Quest'}
              </button>
              {/* Spacer to clear safe area inside scroll container */}
              <div style={{ height: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }} />
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
