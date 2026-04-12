'use client';

import { use, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import UserAvatar from '@/components/ui/UserAvatar';
import Link from 'next/link';

function friendshipId(a: string, b: string) {
  return [a, b].sort().join('_');
}

export default function AddFriendPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { user, loading } = useAuth();
  const router = useRouter();

  const [state, setState] = useState<'loading' | 'ready' | 'already' | 'invalid' | 'done' | 'self'>('loading');
  const [fromProfile, setFromProfile] = useState<{ displayName: string; photoURL?: string; xp: number } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/login'); return; }

    async function resolve() {
      const invSnap = await getDoc(doc(db, 'friendInvites', code));
      if (!invSnap.exists() || invSnap.data().used) { setState('invalid'); return; }
      const fromUid = invSnap.data().fromUid as string;
      if (fromUid === user!.uid) { setState('self'); return; }

      // Check existing friendship
      const fsSnap = await getDoc(doc(db, 'friendships', friendshipId(user!.uid, fromUid)));
      if (fsSnap.exists() && fsSnap.data().status === 'accepted') { setState('already'); return; }

      const fromSnap = await getDoc(doc(db, 'users', fromUid));
      const data = fromSnap.data();
      setFromProfile({ displayName: data?.displayName || 'Someone', photoURL: data?.photoURL, xp: data?.xp || 0 });
      setState('ready');
    }
    resolve();
  }, [user, loading, code]);

  async function accept() {
    if (!user) return;
    setSaving(true);
    const invSnap = await getDoc(doc(db, 'friendInvites', code));
    const fromUid = invSnap.data()!.fromUid as string;
    const id = friendshipId(user.uid, fromUid);
    const [a, b] = id.split('_');
    await setDoc(doc(db, 'friendships', id), {
      userA: a, userB: b, initiator: fromUid, status: 'accepted', createdAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'friendInvites', code), { used: true });
    setState('done');
    setSaving(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center px-6">
      <div className="bg-white rounded-3xl p-8 w-full max-w-sm text-center shadow-2xl">
        {state === 'loading' && <div className="text-4xl animate-pulse">⚡</div>}

        {state === 'invalid' && (
          <>
            <div className="text-4xl mb-3">❌</div>
            <h2 className="font-bold text-gray-900 mb-1">Invalid invite</h2>
            <p className="text-gray-500 text-sm mb-4">This link has expired or already been used.</p>
            <Link href="/dashboard" className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-2xl inline-block">Go Home</Link>
          </>
        )}

        {state === 'self' && (
          <>
            <div className="text-4xl mb-3">🪞</div>
            <h2 className="font-bold text-gray-900 mb-1">That's your own link!</h2>
            <Link href="/friends" className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-2xl inline-block mt-4">Go to Friends</Link>
          </>
        )}

        {state === 'already' && (
          <>
            <div className="text-4xl mb-3">👋</div>
            <h2 className="font-bold text-gray-900 mb-1">Already friends!</h2>
            <Link href="/friends" className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-2xl inline-block mt-4">See Leaderboard</Link>
          </>
        )}

        {state === 'ready' && fromProfile && (
          <>
            <UserAvatar photoURL={fromProfile.photoURL} displayName={fromProfile.displayName} xp={fromProfile.xp} size="xl" className="mx-auto mb-3" />
            <h2 className="font-bold text-gray-900 text-xl mb-1">{fromProfile.displayName}</h2>
            <p className="text-gray-500 text-sm mb-6">wants to be your friend on Guildly</p>
            <button onClick={accept} disabled={saving}
              className="w-full py-3 bg-indigo-600 text-white font-bold rounded-2xl disabled:opacity-50 active:scale-95 transition-transform mb-2">
              {saving ? '…' : 'Accept & Add Friend'}
            </button>
            <Link href="/dashboard" className="block text-sm text-gray-400 mt-1">Maybe later</Link>
          </>
        )}

        {state === 'done' && (
          <>
            <div className="text-4xl mb-3">🎉</div>
            <h2 className="font-bold text-gray-900 mb-1">You're now friends!</h2>
            <p className="text-gray-500 text-sm mb-4">Check the leaderboard to see where you stand.</p>
            <Link href="/friends" className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-2xl inline-block">See Leaderboard</Link>
          </>
        )}
      </div>
    </div>
  );
}
