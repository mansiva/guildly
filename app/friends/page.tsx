'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import AppShell from '@/components/layout/AppShell';
import UserAvatar from '@/components/ui/UserAvatar';
import { xpToLevel } from '@/lib/utils';
import {
  collection, doc, getDoc, getDocs, query, where,
  setDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { UserPlus, Search, Share2, Trophy, UserCheck } from 'lucide-react';

interface UserProfile {
  uid: string;
  displayName: string;
  photoURL?: string;
  xp: number;
  level: number;
  badges: { id: string; emoji: string; name: string }[];
}

function followId(followerId: string, followeeId: string) {
  return `${followerId}_${followeeId}`;
}

export async function followUser(myUid: string, targetUid: string) {
  await setDoc(doc(db, 'follows', followId(myUid, targetUid)), {
    followerId: myUid,
    followeeId: targetUid,
    createdAt: serverTimestamp(),
  });
}

export async function unfollowUser(myUid: string, targetUid: string) {
  await deleteDoc(doc(db, 'follows', followId(myUid, targetUid)));
}

async function loadProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    uid,
    displayName: d.displayName ?? 'Unknown',
    photoURL: d.photoURL,
    xp: d.xp ?? 0,
    level: xpToLevel(d.xp ?? 0).level,
    badges: d.badges ?? [],
  };
}

export default function FriendsPage() {
  const { user } = useAuth();

  const [tab, setTab] = useState<'following' | 'followers'>('following');
  const [following, setFollowing] = useState<UserProfile[]>([]);
  const [followers, setFollowers] = useState<UserProfile[]>([]);
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const router = useRouter();
  const [showSearch, setShowSearch] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [searchError, setSearchError] = useState('');
  const [searching, setSearching] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  const load = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const myUid = user.uid;
      const [followingSnap, followersSnap] = await Promise.all([
        getDocs(query(collection(db, 'follows'), where('followerId', '==', myUid))),
        getDocs(query(collection(db, 'follows'), where('followeeId', '==', myUid))),
      ]);

      const followingUids = followingSnap.docs.map(d => d.data().followeeId as string);
      const followerUids = followersSnap.docs.map(d => d.data().followerId as string);

      setFollowingSet(new Set(followingUids));

      const [followingProfiles, followerProfiles] = await Promise.all([
        Promise.all(followingUids.map(loadProfile)),
        Promise.all(followerUids.map(loadProfile)),
      ]);

      setFollowing(followingProfiles.filter((p): p is UserProfile => p !== null));
      setFollowers(followerProfiles.filter((p): p is UserProfile => p !== null));
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => { load(); }, [load]);

  async function handleSearch() {
    if (!searchInput.trim() || !user) return;
    setSearching(true); setSearchError(''); setSearchResults([]);
    try {
      const input = searchInput.trim().toLowerCase();
      const [nameSnap, emailSnap] = await Promise.all([
        getDocs(query(collection(db, 'users'),
          where('displayNameLower', '>=', input),
          where('displayNameLower', '<=', input + '\uf8ff'))),
        getDocs(query(collection(db, 'users'), where('email', '==', input))),
      ]);
      const seen = new Set<string>();
      const results: UserProfile[] = [];
      for (const d of [...nameSnap.docs, ...emailSnap.docs]) {
        if (seen.has(d.id) || d.id === user.uid) { seen.add(d.id); continue; }
        seen.add(d.id);
        const data = d.data();
        results.push({
          uid: d.id,
          displayName: data.displayName,
          photoURL: data.photoURL,
          xp: data.xp || 0,
          level: xpToLevel(data.xp || 0).level,
          badges: data.badges || [],
        });
      }
      if (results.length === 0) setSearchError('No users found');
      setSearchResults(results);
    } finally { setSearching(false); }
  }

  async function handleFollow(targetUid: string) {
    if (!user) return;
    setToggling(targetUid);
    try {
      await followUser(user.uid, targetUid);
      setFollowingSet(prev => new Set([...prev, targetUid]));
      // Add to following list if not already there
      const profile = await loadProfile(targetUid);
      if (profile) setFollowing(prev => prev.some(f => f.uid === targetUid) ? prev : [profile, ...prev]);
    } finally { setToggling(null); }
  }

  async function handleUnfollow(targetUid: string) {
    if (!user) return;
    setToggling(targetUid);
    try {
      await unfollowUser(user.uid, targetUid);
      setFollowingSet(prev => { const s = new Set(prev); s.delete(targetUid); return s; });
      setFollowing(prev => prev.filter(f => f.uid !== targetUid));
    } finally { setToggling(null); }
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
        await navigator.share({ title: 'Follow me on Guildly', text: "Let's connect on Guildly!", url: link });
      } else {
        await navigator.clipboard.writeText(link);
        alert('Invite link copied!');
      }
    } finally { setSharing(false); }
  }

  const followerUidSet = new Set(followers.map(f => f.uid));
  const list = tab === 'following' ? following : followers;

  if (!user) return (
    <AppShell><div className="flex items-center justify-center h-64"><div className="text-3xl animate-pulse">⚡</div></div></AppShell>
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
            <button onClick={() => { setShowSearch(v => !v); setSearchResults([]); setSearchError(''); setSearchInput(''); }}
              className="p-2.5 bg-indigo-600 rounded-2xl text-white active:scale-95 transition-transform">
              <UserPlus size={18} />
            </button>
          </div>
        </div>

        {/* Search panel */}
        {showSearch && (
          <div className="bg-white rounded-3xl border border-indigo-100 p-4 mb-4 shadow-sm">
            <p className="text-sm font-semibold text-gray-700 mb-3">Find by name or email</p>
            <div className="flex gap-2">
              <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="name or email"
                className="flex-1 px-3 py-2.5 bg-gray-50 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-200 text-gray-900 min-w-0" />
              <button onClick={handleSearch} disabled={searching || !searchInput.trim()}
                className="px-4 py-2.5 bg-indigo-600 text-white rounded-2xl text-sm font-semibold disabled:opacity-50 active:scale-95 transition-transform shrink-0">
                {searching ? '…' : <Search size={16} />}
              </button>
            </div>
            {searchError && <p className="text-xs text-red-500 mt-2">{searchError}</p>}
            {searchResults.length > 0 && (
              <div className="mt-3 space-y-2">
                {searchResults.map(r => {
                  const isFollowing = followingSet.has(r.uid);
                  return (
                    <div key={r.uid} className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl">
                      <UserAvatar photoURL={r.photoURL} displayName={r.displayName} xp={r.xp} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{r.displayName}</p>
                        <p className="text-xs text-gray-400">Level {r.level} · {r.xp} XP</p>
                      </div>
                      {isFollowing ? (
                        <button onClick={() => handleUnfollow(r.uid)} disabled={toggling === r.uid}
                          className="px-3 py-2 bg-gray-100 text-gray-600 text-xs font-semibold rounded-xl active:scale-95 disabled:opacity-50">
                          Unfollow
                        </button>
                      ) : (
                        <button onClick={() => handleFollow(r.uid)} disabled={toggling === r.uid}
                          className="px-3 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl active:scale-95 disabled:opacity-50">
                          {toggling === r.uid ? '…' : 'Follow'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Stats row */}
        <div className="flex gap-3 mb-5">
          <div className="flex-1 bg-white rounded-2xl border border-gray-100 p-3 text-center">
            <p className="text-xl font-bold text-gray-900">{following.length}</p>
            <p className="text-xs text-gray-400">Following</p>
          </div>
          <div className="flex-1 bg-white rounded-2xl border border-gray-100 p-3 text-center">
            <p className="text-xl font-bold text-gray-900">{followers.length}</p>
            <p className="text-xs text-gray-400">Followers</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {([['following', 'Following'], ['followers', 'Followers']] as const).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-2xl text-sm font-semibold transition-colors ${tab === t ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center py-12 text-gray-400 text-sm">Loading…</div>
        ) : list.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">{tab === 'following' ? '👀' : '👥'}</div>
            <p className="text-gray-500 text-sm">
              {tab === 'following' ? 'Not following anyone yet — search to find people' : 'No followers yet'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            {list.map((p) => {
              const isFollowingThem = followingSet.has(p.uid);
              const isMutual = followerUidSet.has(p.uid) && followingSet.has(p.uid);
              return (
                <button
                  key={p.uid}
                  onClick={() => router.push(`/profile/${p.uid}`)}
                  className="w-full flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 active:bg-gray-50 transition-colors text-left"
                >
                  <UserAvatar photoURL={p.photoURL} displayName={p.displayName} xp={p.xp} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold text-gray-900 truncate">{p.displayName}</p>
                      {isMutual && (
                        <span className="text-xs text-indigo-500 font-medium bg-indigo-50 px-1.5 py-0.5 rounded-full">mutual</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">Level {p.level} · {p.xp.toLocaleString()} XP</p>
                  </div>
                  {isFollowingThem && (
                    <UserCheck size={14} className="text-indigo-400 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {!loading && list.length > 0 && (
          <div className="mt-4 bg-white rounded-3xl border border-dashed border-gray-200 p-5 text-center">
            <Trophy size={24} className="text-indigo-300 mx-auto mb-2" />
            <p className="text-xs text-gray-400">Follow more people to grow your network</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
