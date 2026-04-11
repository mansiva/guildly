'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  doc, getDoc, collection, addDoc, updateDoc, arrayUnion, arrayRemove,
  serverTimestamp, query, where, getDocs, Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import AppShell from '@/components/layout/AppShell';
import { Group } from '@/types';
import { Plus, Users, Crown, UserPlus, Share2, Shield, Trash2 } from 'lucide-react';
import Link from 'next/link';

const GROUP_EMOJIS = ['🔥', '⚡', '🚀', '🎯', '💪', '🏆', '🌟', '🎮', '🧠', '❤️', '🌿', '🎨'];

function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default function GroupsPage() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [groupEmoji, setGroupEmoji] = useState('🔥');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      const ref = await addDoc(collection(db, 'groups'), {
        name: groupName.trim(),
        description: groupDesc.trim(),
        emoji: groupEmoji,
        ownerId: user.uid,
        adminIds: [user.uid],
        memberIds: [user.uid],
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

  async function joinByCode() {
    if (!user || !joinCode.trim()) return;
    setLoading(true); setError('');
    try {
      // Try invite code first
      const q = query(collection(db, 'invites'), where('code', '==', joinCode.trim().toUpperCase()));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const inviteDoc = snap.docs[0];
        const invite = inviteDoc.data();
        if (invite.used) { setError('This invite has already been used'); setLoading(false); return; }
        await updateDoc(doc(db, 'invites', inviteDoc.id), { used: true, usedBy: user.uid, usedAt: serverTimestamp() });
        await updateDoc(doc(db, 'groups', invite.groupId), { memberIds: arrayUnion(user.uid) });
        await updateDoc(doc(db, 'users', user.uid), { groupIds: arrayUnion(invite.groupId) });
        setShowJoin(false); setJoinCode('');
        await loadGroups();
        return;
      }
      setError('Invalid invite code');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to join');
    } finally { setLoading(false); }
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
              <button onClick={() => setShowCreate(false)} className="flex-1 py-3 border border-gray-200 text-gray-700 rounded-2xl text-sm font-medium">Cancel</button>
              <button onClick={createGroup} disabled={loading || !groupName.trim()}
                className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-semibold disabled:opacity-50">
                {loading ? '...' : `Create ${groupEmoji}`}
              </button>
            </div>
          </div>
        )}

        {/* Join form */}
        {showJoin && (
          <div className="bg-white rounded-3xl p-5 mb-4 border border-indigo-100 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4">Join a Group</h3>
            <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} placeholder="Invite code"
              maxLength={8} className="w-full px-4 py-3 bg-gray-50 text-gray-900 rounded-2xl text-sm mb-3 outline-none focus:ring-2 focus:ring-indigo-200 tracking-widest text-center font-mono text-lg uppercase" />
            {error && <p className="text-red-500 text-xs mb-2 text-center">{error}</p>}
            <div className="flex gap-2">
              <button onClick={() => setShowJoin(false)} className="flex-1 py-3 border border-gray-200 text-gray-700 rounded-2xl text-sm font-medium">Cancel</button>
              <button onClick={joinByCode} disabled={loading || !joinCode.trim()}
                className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-semibold disabled:opacity-50">
                {loading ? '...' : 'Join'}
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
              const isOwner = g.ownerId === user!.uid;
              const isAdmin = g.adminIds?.includes(user!.uid);
              return (
                <GroupCard key={g.id} group={g} userId={user!.uid} isOwner={isOwner} isAdmin={isAdmin} onUpdate={loadGroups} />
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function GroupCard({ group, userId, isOwner, isAdmin, onUpdate }: {
  group: Group; userId: string; isOwner: boolean; isAdmin: boolean; onUpdate: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [members, setMembers] = useState<{ uid: string; displayName: string; photoURL?: string }[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [sharing, setSharing] = useState(false);

  async function loadMembers() {
    setLoadingMembers(true);
    const loaded = await Promise.all(group.memberIds.map(async uid => {
      const snap = await getDoc(doc(db, 'users', uid));
      return snap.exists() ? { uid, ...snap.data() } as { uid: string; displayName: string; photoURL?: string } : null;
    }));
    setMembers(loaded.filter(Boolean) as { uid: string; displayName: string; photoURL?: string }[]);
    setLoadingMembers(false);
  }

  async function handleInvite() {
    setSharing(true);
    try {
      // Generate single-use invite
      const code = generateCode();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 day expiry

      await addDoc(collection(db, 'invites'), {
        code,
        groupId: group.id,
        createdBy: userId,
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(expiresAt),
        used: false,
      });

      const link = `${window.location.origin}/join/${code}`;
      const text = `Join my group "${group.name}" on Guildly! ${link}`;

      if (navigator.share) {
        await navigator.share({ title: `Join ${group.name} on Guildly`, text, url: link });
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

  async function removeMember(uid: string) {
    if (!confirm('Remove this member?')) return;
    await updateDoc(doc(db, 'groups', group.id), { memberIds: arrayRemove(uid) });
    await updateDoc(doc(db, 'users', uid), { groupIds: arrayRemove(group.id) });
    setMembers(prev => prev.filter(m => m.uid !== uid));
    onUpdate();
  }

  async function promoteToAdmin(uid: string) {
    await updateDoc(doc(db, 'groups', group.id), { adminIds: arrayUnion(uid) });
    onUpdate();
  }

  async function demoteAdmin(uid: string) {
    await updateDoc(doc(db, 'groups', group.id), { adminIds: arrayRemove(uid) });
    onUpdate();
  }

  function getRoleBadge(uid: string) {
    if (uid === group.ownerId) return <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full font-medium flex items-center gap-1"><Crown size={10} /> Owner</span>;
    if (group.adminIds?.includes(uid)) return <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-medium flex items-center gap-1"><Shield size={10} /> Admin</span>;
    return null;
  }

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-3 p-4">
        <span className="text-3xl">{group.emoji}</span>
        <Link href={`/groups/${group.id}`} className="flex-1 min-w-0">
          <div className="font-bold text-gray-900 truncate">{group.name}</div>
          {group.description && <p className="text-xs text-gray-500 truncate">{group.description}</p>}
        </Link>
        <div className="flex items-center gap-2 shrink-0">
          <span className="flex items-center gap-1 text-xs text-gray-400"><Users size={12} />{group.memberIds?.length || 0}</span>
          {(isAdmin || isOwner) && (
            <button onClick={() => { setExpanded(!expanded); if (!expanded) loadMembers(); }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gray-100 text-gray-500 text-xs font-medium active:scale-95 transition-transform">
              Manage {expanded ? '▲' : '▼'}
            </button>
          )}
        </div>
      </div>

      {/* Admin panel */}
      {expanded && (isAdmin || isOwner) && (
        <div className="border-t border-gray-100 px-4 pb-4">
          {/* Invite button */}
          <button onClick={handleInvite} disabled={sharing}
            className="w-full mt-3 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50">
            {sharing ? '...' : <><UserPlus size={16} /> <Share2 size={14} /> Invite Member</>}
          </button>
          <p className="text-xs text-gray-400 text-center mt-1">Generates a single-use link · expires in 7 days</p>

          {/* Members list */}
          <h4 className="font-semibold text-gray-700 text-sm mt-4 mb-2">Members</h4>
          {loadingMembers ? (
            <p className="text-xs text-gray-400 text-center py-2">Loading...</p>
          ) : (
            <div className="space-y-2">
              {members.map(m => {
                const memberIsOwner = m.uid === group.ownerId;
                const memberIsAdmin = group.adminIds?.includes(m.uid);
                const canRemove = !memberIsOwner && (isOwner || (isAdmin && !memberIsAdmin));
                const canToggleAdmin = isOwner && !memberIsOwner && m.uid !== userId;

                return (
                  <div key={m.uid} className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-sm font-bold text-indigo-600 shrink-0">
                      {m.displayName?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-medium text-gray-800 truncate">{m.displayName}</span>
                        {getRoleBadge(m.uid)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {canToggleAdmin && (
                        <button onClick={() => memberIsAdmin ? demoteAdmin(m.uid) : promoteToAdmin(m.uid)}
                          className="p-1.5 rounded-lg bg-indigo-50 text-indigo-500 text-xs">
                          <Shield size={13} />
                        </button>
                      )}
                      {canRemove && (
                        <button onClick={() => removeMember(m.uid)}
                          className="p-1.5 rounded-lg bg-red-50 text-red-400">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
