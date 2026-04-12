'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { doc, setDoc, collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import AppShell from '@/components/layout/AppShell';
import GroupCard from '@/components/groups/GroupCard';
import { useUserGroups, useGroupStats } from '@/hooks/useGroup';
import { Group } from '@/types';
import { Plus } from 'lucide-react';

const GROUP_EMOJIS = ['🔥', '⚡', '🚀', '🎯', '💪', '🏆', '🌟', '🎮', '🧠', '❤️', '🌿', '🎨'];

export default function GroupsPage() {
  const { user } = useAuth();
  const { groups, loading } = useUserGroups(user?.uid || null);
  const groupIds = groups.map(g => g.id);
  const groupStats = useGroupStats(groupIds);

  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [groupEmoji, setGroupEmoji] = useState('🔥');
  const [joinCode, setJoinCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function createGroup() {
    if (!user || !groupName.trim()) return;
    setSaving(true); setError('');
    try {
      const ref = await addDoc(collection(db, 'groups'), {
        name: groupName.trim(),
        description: groupDesc.trim(),
        emoji: groupEmoji,
        maxMembers: 50,
        xp: 0,
        badges: [],
        createdAt: serverTimestamp(),
      });
      await setDoc(doc(db, 'groupMembers', `${ref.id}_${user.uid}`), {
        groupId: ref.id,
        userId: user.uid,
        role: 'owner',
        joinedAt: serverTimestamp(),
      });
      setShowCreate(false); setGroupName(''); setGroupDesc(''); setGroupEmoji('🔥');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create');
    } finally { setSaving(false); }
  }

  async function joinByCode() {
    if (!user || !joinCode.trim()) return;
    setSaving(true); setError('');
    try {
      const q = query(collection(db, 'invites'), where('code', '==', joinCode.trim().toUpperCase()));
      const snap = await getDocs(q);
      if (snap.empty) { setError('Invalid invite code'); setSaving(false); return; }
      const inviteDoc = snap.docs[0];
      const invite = inviteDoc.data();
      if (invite.used) { setError('This invite has already been used'); setSaving(false); return; }
      await setDoc(doc(db, 'groupMembers', `${invite.groupId}_${user.uid}`), {
        groupId: invite.groupId, userId: user.uid, role: 'member', joinedAt: serverTimestamp(),
      });
      setShowJoin(false); setJoinCode('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to join');
    } finally { setSaving(false); }
  }

  return (
    <AppShell>
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Groups</h1>
          <div className="flex gap-2">
            <button onClick={() => { setShowJoin(true); setShowCreate(false); setError(''); }}
              className="px-3 py-2 border border-indigo-200 text-indigo-600 rounded-2xl text-sm font-medium active:scale-95 transition-transform">
              Join
            </button>
            <button onClick={() => { setShowCreate(true); setShowJoin(false); setError(''); }}
              className="px-3 py-2 bg-indigo-600 text-white rounded-2xl text-sm font-medium flex items-center gap-1 active:scale-95 transition-transform">
              <Plus size={16} /> New
            </button>
          </div>
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="bg-white rounded-3xl p-5 mb-4 border border-indigo-100 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4">Create Group</h3>
            <div className="flex gap-2 flex-wrap mb-3">
              {GROUP_EMOJIS.map(e => (
                <button key={e} onClick={() => setGroupEmoji(e)}
                  className={`text-2xl p-2 rounded-xl transition-all ${groupEmoji === e ? 'bg-indigo-100 scale-110' : 'hover:bg-gray-100'}`}>
                  {e}
                </button>
              ))}
            </div>
            <input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Group name" maxLength={40}
              className="w-full px-4 py-3 bg-gray-50 text-gray-900 rounded-2xl text-sm mb-3 outline-none focus:ring-2 focus:ring-indigo-200" />
            <input value={groupDesc} onChange={e => setGroupDesc(e.target.value)} placeholder="Description (optional)" maxLength={100}
              className="w-full px-4 py-3 bg-gray-50 text-gray-900 rounded-2xl text-sm mb-3 outline-none focus:ring-2 focus:ring-indigo-200" />
            {error && <p className="text-red-500 text-xs mb-2">{error}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setShowCreate(false); setError(''); }}
                className="flex-1 py-3 border border-gray-200 text-gray-700 rounded-2xl text-sm font-medium">Cancel</button>
              <button onClick={createGroup} disabled={saving || !groupName.trim()}
                className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-semibold disabled:opacity-50">
                {saving ? '…' : `Create ${groupEmoji}`}
              </button>
            </div>
          </div>
        )}

        {/* Join form */}
        {showJoin && (
          <div className="bg-white rounded-3xl p-5 mb-4 border border-indigo-100 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4">Join a Group</h3>
            <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} placeholder="INVITE CODE"
              maxLength={8} className="w-full px-4 py-3 bg-gray-50 text-gray-900 rounded-2xl text-sm mb-3 outline-none focus:ring-2 focus:ring-indigo-200 tracking-widest text-center font-mono text-lg uppercase" />
            {error && <p className="text-red-500 text-xs mb-2 text-center">{error}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setShowJoin(false); setError(''); }}
                className="flex-1 py-3 border border-gray-200 text-gray-700 rounded-2xl text-sm font-medium">Cancel</button>
              <button onClick={joinByCode} disabled={saving || !joinCode.trim()}
                className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-semibold disabled:opacity-50">
                {saving ? '…' : 'Join'}
              </button>
            </div>
          </div>
        )}

        {/* Groups list */}
        {loading ? (
          <div className="text-center py-12 text-gray-400 text-sm">Loading…</div>
        ) : groups.length === 0 && !showCreate && !showJoin ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">👥</div>
            <p className="text-gray-500">No groups yet — create one or join with an invite code</p>
          </div>
        ) : (
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
        )}
      </div>
    </AppShell>
  );
}
