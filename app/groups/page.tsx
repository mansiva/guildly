'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { doc, getDoc, collection, addDoc, updateDoc, arrayUnion, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import AppShell from '@/components/layout/AppShell';
import { Group } from '@/types';
import { generateInviteCode } from '@/lib/utils';
import { Plus, Copy, Users, Crown } from 'lucide-react';
import Link from 'next/link';

const GROUP_EMOJIS = ['🔥', '⚡', '🚀', '🎯', '💪', '🏆', '🌟', '🎮', '🧠', '❤️', '🌿', '🎨'];

export default function GroupsPage() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [groupEmoji, setGroupEmoji] = useState('🔥');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  async function loadGroups() {
    if (!user) return;
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (!snap.exists()) return;
    const gIds: string[] = snap.data().groupIds || [];
    const loaded = await Promise.all(gIds.map(async id => {
      const gs = await getDoc(doc(db, 'groups', id));
      return gs.exists() ? { id: gs.id, ...gs.data() } as Group : null;
    }));
    setGroups(loaded.filter(Boolean) as Group[]);
  }

  useEffect(() => { loadGroups(); }, [user]);

  async function createGroup() {
    if (!user || !groupName.trim()) return;
    setLoading(true); setError('');
    try {
      const code = generateInviteCode();
      const ref = await addDoc(collection(db, 'groups'), {
        name: groupName.trim(),
        description: groupDesc.trim(),
        emoji: groupEmoji,
        adminIds: [user.uid],
        memberIds: [user.uid],
        inviteCode: code,
        maxMembers: 50,
        xp: 0,
        badges: [],
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'users', user.uid), { groupIds: arrayUnion(ref.id) });
      setShowCreate(false); setGroupName(''); setGroupDesc('');
      await loadGroups();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create');
    } finally { setLoading(false); }
  }

  async function joinGroup() {
    if (!user || !inviteCode.trim()) return;
    setLoading(true); setError('');
    try {
      const q = query(collection(db, 'groups'), where('inviteCode', '==', inviteCode.trim().toUpperCase()));
      const snap = await getDocs(q);
      if (snap.empty) { setError('Invalid invite code'); setLoading(false); return; }
      const groupDoc = snap.docs[0];
      const groupData = groupDoc.data() as Group;
      if (groupData.memberIds?.includes(user.uid)) { setError('Already a member'); setLoading(false); return; }
      if ((groupData.memberIds?.length || 0) >= groupData.maxMembers) { setError('Group is full'); setLoading(false); return; }
      await updateDoc(doc(db, 'groups', groupDoc.id), { memberIds: arrayUnion(user.uid) });
      await updateDoc(doc(db, 'users', user.uid), { groupIds: arrayUnion(groupDoc.id) });
      setShowJoin(false); setInviteCode('');
      await loadGroups();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to join');
    } finally { setLoading(false); }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <AppShell>
      <div className="px-4 pt-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Groups</h1>
          <div className="flex gap-2">
            <button onClick={() => { setShowJoin(true); setShowCreate(false); setError(''); }}
              className="px-3 py-2 border border-indigo-200 text-indigo-600 rounded-2xl text-sm font-medium">
              Join
            </button>
            <button onClick={() => { setShowCreate(true); setShowJoin(false); setError(''); }}
              className="px-3 py-2 bg-indigo-600 text-white rounded-2xl text-sm font-medium flex items-center gap-1">
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
              <button onClick={() => setShowCreate(false)} className="flex-1 py-3 border border-gray-200 rounded-2xl text-sm font-medium">Cancel</button>
              <button onClick={createGroup} disabled={loading || !groupName.trim()}
                className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-semibold disabled:opacity-50">
                {loading ? '...' : 'Create ' + groupEmoji}
              </button>
            </div>
          </div>
        )}

        {/* Join form */}
        {showJoin && (
          <div className="bg-white rounded-3xl p-5 mb-4 border border-indigo-100 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4">Join a Group</h3>
            <input value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())} placeholder="Invite code (e.g. XK9F2T)"
              maxLength={6} className="w-full px-4 py-3 bg-gray-50 text-gray-900 rounded-2xl text-sm mb-3 outline-none focus:ring-2 focus:ring-indigo-200 tracking-widest text-center font-mono text-lg uppercase" />
            {error && <p className="text-red-500 text-xs mb-2 text-center">{error}</p>}
            <div className="flex gap-2">
              <button onClick={() => setShowJoin(false)} className="flex-1 py-3 border border-gray-200 rounded-2xl text-sm font-medium">Cancel</button>
              <button onClick={joinGroup} disabled={loading || !inviteCode.trim()}
                className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-semibold disabled:opacity-50">
                {loading ? '...' : 'Join Group'}
              </button>
            </div>
          </div>
        )}

        {/* Groups list */}
        {groups.length === 0 && !showCreate && !showJoin ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">👥</div>
            <p className="text-gray-500">No groups yet — create one or join with an invite code</p>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map(g => {
              const isAdmin = g.adminIds?.includes(user!.uid);
              return (
                <Link key={g.id} href={`/groups/${g.id}`}
                  className="block bg-white rounded-3xl p-4 border border-gray-100 shadow-sm active:scale-95 transition-transform">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{g.emoji}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900">{g.name}</span>
                        {isAdmin && <Crown size={14} className="text-yellow-500" />}
                      </div>
                      {g.description && <p className="text-xs text-gray-500">{g.description}</p>}
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Users size={12} /> {g.memberIds?.length || 0}
                      </div>
                      <button onClick={(e) => { e.preventDefault(); copyCode(g.inviteCode); }}
                        className="flex items-center gap-1 text-xs text-indigo-500 mt-1">
                        <Copy size={11} /> {copied === g.inviteCode ? 'Copied!' : g.inviteCode}
                      </button>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
