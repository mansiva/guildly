'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import AppShell from '@/components/layout/AppShell';
import UserAvatar from '@/components/ui/UserAvatar';
import { xpToLevel } from '@/lib/utils';
import {
  collection, doc, getDoc, getDocs, query, where, setDoc,
  updateDoc, serverTimestamp, orderBy, limit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UserPlus, Search, Share2, Check, X, Trophy, Users } from 'lucide-react';

interface FriendProfile {
  uid: string;
  displayName: string;
  photoURL?: string;
  xp: number;
  xpMonth: number;
  xpMonthKey: string;
  level: number;
  badges: { id: string; emoji: string; name: string }[];
  sharedGroups?: number;
}

interface FriendRequest {
  id: string;
  fromUid: string;
  fromName: string;
  fromPhoto?: string;
  createdAt: Date;
}

function friendshipId(a: string, b: string) {
  return [a, b].sort().join('_');
}

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function FriendsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'month' | 'alltime'>('month');
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [pendingIn, setPendingIn] = useState<FriendRequest[]>([]);
  const [myProfile, setMyProfile] = useState<FriendProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const [showAdd, setShowAdd] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchResult, setSearchResult] = useState<FriendProfile | null>(null);
  const [searchError, setSearchError] = useState('');
  const [searching, setSearching] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [sharing, setSharing] = useState(false);

  // My group IDs for shared group calculation
  const [myGroupIds, setMyGroupIds] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // My group memberships
    const myGroupsSnap = await getDocs(query(collection(db, 'groupMembers'), where('userId', '==', user.uid)));
    const gids = myGroupsSnap.docs.map(d => d.data().groupId as string);
    setMyGroupIds(gids);

    // My profile
    const mySnap = await getDoc(doc(db, 'users', user.uid));
    const myData = mySnap.data();
    if (myData) {
      setMyProfile({
        uid: user.uid,
        displayName: myData.displayName,
        photoURL: myData.photoURL,
        xp: myData.xp || 0,
        xpMonth: myData.xpMonthKey === currentMonthKey() ? (myData.xpMonth || 0) : 0,
        xpMonthKey: myData.xpMonthKey || '',
        level: xpToLevel(myData.xp || 0).level,
        badges: myData.badges || [],
      });
    }

    // Accepted friendships
    const [sentSnap, recvSnap] = await Promise.all([
      getDocs(query(collection(db, 'friendships'), where('userA', '==', user.uid), where('status', '==', 'accepted'))),
      getDocs(query(collection(db, 'friendships'), where('userB', '==', user.uid), where('status', '==', 'accepted'))),
    ]);
    const friendUids = [
      ...sentSnap.docs.map(d => d.data().userB as string),
      ...recvSnap.docs.map(d => d.data().userA as string),
    ];

    // Pending incoming requests
    const pendingSnap = await getDocs(
      query(collection(db, 'friendships'), where('userB', '==', user.uid), where('status', '==', 'pending'))
    );
    const incoming: FriendRequest[] = await Promise.all(pendingSnap.docs.map(async d => {
      const data = d.data();
      const fromSnap = await getDoc(doc(db, 'users', data.userA));
      const fromData = fromSnap.data();
      return {
        id: d.id,
        fromUid: data.userA,
        fromName: fromData?.displayName || 'Someone',
        fromPhoto: fromData?.photoURL,
        createdAt: data.createdAt?.toDate?.() || new Date(),
      };
    }));
    setPendingIn(incoming);

    // Load friend profiles
    const loaded: (FriendProfile | null)[] = await Promise.all(friendUids.map(async uid => {
      const snap = await getDoc(doc(db, 'users', uid));
      const data = snap.data();
      if (!data) return null;
      // Count shared groups
      const friendGroupsSnap = await getDocs(query(collection(db, 'groupMembers'), where('userId', '==', uid)));
      const friendGids = friendGroupsSnap.docs.map(d => d.data().groupId as string);
      const shared = friendGids.filter(g => gids.includes(g)).length;
      return {
        uid,
        displayName: data.displayName,
        photoURL: data.photoURL,
        xp: data.xp || 0,
        xpMonth: data.xpMonthKey === currentMonthKey() ? (data.xpMonth || 0) : 0,
        xpMonthKey: data.xpMonthKey || '',
        level: xpToLevel(data.xp || 0).level,
        badges: data.badges || [],
        sharedGroups: shared,
      };
    }));
    setFriends(loaded.filter((p): p is FriendProfile => p !== null));
    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleSearch() {
    if (!searchInput.trim() || !user) return;
    setSearching(true); setSearchError(''); setSearchResult(null);
    try {
      const input = searchInput.trim().toLowerCase();
      // Search by username or email
      let snap = await getDocs(query(collection(db, 'users'), where('username', '==', input), limit(1)));
      if (snap.empty) {
        snap = await getDocs(query(collection(db, 'users'), where('email', '==', input), limit(1)));
      }
      if (snap.empty) { setSearchError('No user found with that username or email'); return; }
      const data = snap.docs[0].data();
      const uid = snap.docs[0].id;
      if (uid === user.uid) { setSearchError("That's you!"); return; }
      // Check if already friends
      const fsSnap = await getDoc(doc(db, 'friendships', friendshipId(user.uid, uid)));
      if (fsSnap.exists()) {
        const status = fsSnap.data().status;
        setSearchError(status === 'accepted' ? 'Already friends!' : 'Friend request already sent');
        return;
      }
      setSearchResult({ uid, displayName: data.displayName, photoURL: data.photoURL, xp: data.xp || 0, xpMonth: 0, xpMonthKey: '', level: xpToLevel(data.xp || 0).level, badges: data.badges || [] });
    } finally { setSearching(false); }
  }

  async function sendRequest(toUid: string) {
    if (!user) return;
    setRequesting(true);
    try {
      const id = friendshipId(user.uid, toUid);
      const [a, b] = id.split('_');
      await setDoc(doc(db, 'friendships', id), {
        userA: a, userB: b,
        initiator: user.uid,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      setSearchResult(null); setSearchInput(''); setShowAdd(false);
    } finally { setRequesting(false); }
  }

  async function acceptRequest(id: string) {
    await updateDoc(doc(db, 'friendships', id), { status: 'accepted' });
    await loadData();
  }

  async function declineRequest(id: string) {
    await updateDoc(doc(db, 'friendships', id), { status: 'declined' });
    setPendingIn(prev => prev.filter(r => r.id !== id));
  }

  async function handleShareInvite() {
    if (!user) return;
    setSharing(true);
    try {
      const code = Math.random().toString(36).substring(2, 9).toUpperCase();
      await setDoc(doc(db, 'friendInvites', code), {
        code, fromUid: user.uid, createdAt: serverTimestamp(), used: false,
      });
      const base = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
      const link = `${base}/add-friend/${code}`;
      if (navigator.share) {
        await navigator.share({ title: 'Add me on Guildly', text: "Let's be friends on Guildly!", url: link });
      } else {
        await navigator.clipboard.writeText(link);
        alert('Friend invite link copied!');
      }
    } finally { setSharing(false); }
  }

  // Leaderboard: me + friends sorted by xp metric
  const allProfiles = myProfile ? [myProfile, ...friends] : friends;
  const sorted = [...allProfiles].sort((a, b) =>
    tab === 'month' ? b.xpMonth - a.xpMonth : b.xp - a.xp
  );

  return (
    <AppShell>
      <div className="px-4 pt-6 pb-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-2xl font-bold text-gray-900">Friends</h1>
          <div className="flex gap-2">
            <button onClick={handleShareInvite} disabled={sharing}
              className="p-2.5 bg-gray-100 rounded-2xl text-gray-500 active:scale-95 transition-transform">
              <Share2 size={18} />
            </button>
            <button onClick={() => { setShowAdd(v => !v); setSearchResult(null); setSearchError(''); setSearchInput(''); }}
              className="p-2.5 bg-indigo-600 rounded-2xl text-white active:scale-95 transition-transform">
              <UserPlus size={18} />
            </button>
          </div>
        </div>

        {/* Add friend panel */}
        {showAdd && (
          <div className="bg-white rounded-3xl border border-indigo-100 p-4 mb-4 shadow-sm">
            <p className="text-sm font-semibold text-gray-700 mb-3">Find by username or email</p>
            <div className="flex gap-2">
              <input
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="username or email"
                className="flex-1 px-3 py-2.5 bg-gray-50 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-200 text-gray-900 min-w-0"
              />
              <button onClick={handleSearch} disabled={searching || !searchInput.trim()}
                className="px-4 py-2.5 bg-indigo-600 text-white rounded-2xl text-sm font-semibold disabled:opacity-50 active:scale-95 transition-transform shrink-0">
                {searching ? '…' : <Search size={16} />}
              </button>
            </div>
            {searchError && <p className="text-xs text-red-500 mt-2">{searchError}</p>}
            {searchResult && (
              <div className="flex items-center gap-3 mt-3 p-3 bg-gray-50 rounded-2xl">
                <UserAvatar photoURL={searchResult.photoURL} displayName={searchResult.displayName} xp={searchResult.xp} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{searchResult.displayName}</p>
                  <p className="text-xs text-gray-400">Level {searchResult.level} · {searchResult.xp} XP</p>
                </div>
                <button onClick={() => sendRequest(searchResult!.uid)} disabled={requesting}
                  className="px-3 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl active:scale-95 transition-transform disabled:opacity-50">
                  {requesting ? '…' : 'Add'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Pending requests */}
        {pendingIn.length > 0 && (
          <div className="mb-4">
            <h2 className="text-sm font-bold text-gray-700 mb-2">Friend Requests ({pendingIn.length})</h2>
            <div className="space-y-2">
              {pendingIn.map(r => (
                <div key={r.id} className="flex items-center gap-3 bg-white rounded-2xl border border-indigo-100 px-4 py-3">
                  <UserAvatar photoURL={r.fromPhoto} displayName={r.fromName} size="sm" />
                  <span className="flex-1 text-sm font-medium text-gray-900 truncate">{r.fromName}</span>
                  <button onClick={() => acceptRequest(r.id)}
                    className="p-2 bg-indigo-600 text-white rounded-xl active:scale-95 transition-transform">
                    <Check size={15} />
                  </button>
                  <button onClick={() => declineRequest(r.id)}
                    className="p-2 bg-gray-100 text-gray-500 rounded-xl active:scale-95 transition-transform">
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {(['month', 'alltime'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-2xl text-sm font-semibold transition-colors ${tab === t ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}>
              {t === 'month' ? 'This Month' : 'All Time'}
            </button>
          ))}
        </div>

        {/* Leaderboard */}
        {loading ? (
          <div className="text-center py-12 text-gray-400 text-sm">Loading…</div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">👥</div>
            <p className="text-gray-500 text-sm">No friends yet — add some to start competing!</p>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            {sorted.map((p, i) => {
              const isMe = p.uid === user?.uid;
              const xpValue = tab === 'month' ? p.xpMonth : p.xp;
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
              return (
                <div key={p.uid}
                  className={`flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 ${isMe ? 'bg-indigo-50' : ''}`}>
                  {/* Rank */}
                  <div className="w-7 text-center shrink-0">
                    {medal
                      ? <span className="text-lg">{medal}</span>
                      : <span className="text-sm font-bold text-gray-300">{i + 1}</span>
                    }
                  </div>
                  <UserAvatar photoURL={p.photoURL} displayName={p.displayName} xp={p.xp} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-sm font-semibold truncate ${isMe ? 'text-indigo-700' : 'text-gray-900'}`}>
                        {isMe ? 'You' : p.displayName}
                      </span>
                      {isMe && <span className="text-xs text-indigo-400 font-medium shrink-0">· you</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">Level {p.level}</span>
                      {p.sharedGroups ? (
                        <span className="text-xs text-gray-400 flex items-center gap-0.5">
                          <Users size={10} /> {p.sharedGroups} shared
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-sm font-bold ${isMe ? 'text-indigo-600' : 'text-gray-700'}`}>
                      {xpValue.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-400">XP</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty friends state with trophy */}
        {!loading && friends.length === 0 && (
          <div className="mt-4 bg-white rounded-3xl border border-dashed border-gray-200 p-5 text-center">
            <Trophy size={24} className="text-indigo-300 mx-auto mb-2" />
            <p className="text-xs text-gray-400">Add friends to compare progress and climb the leaderboard</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
