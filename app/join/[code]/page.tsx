'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc, setDoc, serverTimestamp, getDocs, collection, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

function friendshipId(a: string, b: string) { return [a, b].sort().join('_'); }
import { useAuth } from '@/context/AuthContext';
import Image from 'next/image';

type State = 'loading' | 'joining' | 'joined' | 'used' | 'expired' | 'invalid' | 'error';

export default function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [state, setState] = useState<State>('loading');
  const [groupId, setGroupId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (authLoading) return;

    // Not logged in → send to login, come back here after
    if (!user) {
      router.replace(`/login?redirect=/join/${code}`);
      return;
    }

    // Logged in → process the invite
    processInvite();
  }, [authLoading, user]);

  async function processInvite() {
    try {
      const inviteRef = doc(db, 'invites', code.toUpperCase());
      const inviteSnap = await getDoc(inviteRef);

      if (!inviteSnap.exists()) {
        setState('invalid');
        return;
      }

      const invite = inviteSnap.data();

      if (invite.used) {
        setState('used');
        return;
      }

      if (invite.expiresAt && invite.expiresAt.toDate() < new Date()) {
        setState('expired');
        return;
      }

      setGroupId(invite.groupId);

      // Already a member?
      const memberRef = doc(db, 'groupMembers', `${invite.groupId}_${user!.uid}`);
      const memberSnap = await getDoc(memberRef);
      if (memberSnap.exists()) {
        router.replace(`/groups/${invite.groupId}`);
        return;
      }

      setState('joining');

      // Mark invite used
      await updateDoc(inviteRef, {
        used: true,
        usedBy: user!.uid,
        usedAt: serverTimestamp(),
      });

      // Add to group
      await setDoc(memberRef, {
        groupId: invite.groupId,
        userId: user!.uid,
        role: 'member',
        joinedAt: serverTimestamp(),
      });

      // Auto-friend all existing members (skip self, skip already-accepted, restore if removed)
      const existingMembersSnap = await getDocs(
        query(collection(db, 'groupMembers'), where('groupId', '==', invite.groupId))
      );
      await Promise.all(existingMembersSnap.docs.map(async d => {
        const otherUid = d.data().userId as string;
        if (otherUid === user!.uid) return;
        const fsId = friendshipId(user!.uid, otherUid);
        const [a, b] = fsId.split('_');
        const fsSnap = await getDoc(doc(db, 'friendships', fsId));
        if (!fsSnap.exists() || fsSnap.data().status === 'removed') {
          await setDoc(doc(db, 'friendships', fsId), {
            userA: a, userB: b,
            initiator: 'group',
            status: 'accepted',
            createdAt: serverTimestamp(),
          }, { merge: true });
        }
        // If pending or accepted, leave as-is
      }));

      setState('joined');
      setTimeout(() => router.replace(`/groups/${invite.groupId}`), 1500);

    } catch (e) {
      console.error(e);
      setErrorMsg('Something went wrong. Please try again.');
      setState('error');
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Image src="/logo.png" alt="Guildly" width={72} height={72} className="mx-auto mb-2 drop-shadow-xl" />
          <span className="text-white font-bold text-xl">Guildly</span>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
          {state === 'loading' && (
            <div className="py-4">
              <div className="text-4xl animate-pulse mb-3">⚡</div>
              <p className="text-gray-500 text-sm">Checking invite...</p>
            </div>
          )}

          {state === 'joining' && (
            <div className="py-4">
              <div className="text-4xl animate-pulse mb-3">⚡</div>
              <p className="text-gray-600 font-medium">Joining group...</p>
            </div>
          )}

          {state === 'joined' && (
            <div className="py-4">
              <div className="text-5xl mb-3">🎉</div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">You're in!</h2>
              <p className="text-gray-500 text-sm">Taking you to your group...</p>
            </div>
          )}

          {state === 'used' && (
            <div className="py-4">
              <div className="text-5xl mb-3">🔒</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Link already used</h2>
              <p className="text-gray-500 text-sm mb-6">This invite link has already been used. Ask your group admin for a new one.</p>
              <a href="/dashboard" className="text-indigo-600 font-medium text-sm">Go to Guildly →</a>
            </div>
          )}

          {state === 'expired' && (
            <div className="py-4">
              <div className="text-5xl mb-3">⏰</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Link expired</h2>
              <p className="text-gray-500 text-sm mb-6">This invite has expired. Ask your group admin for a fresh one.</p>
              <a href="/dashboard" className="text-indigo-600 font-medium text-sm">Go to Guildly →</a>
            </div>
          )}

          {state === 'invalid' && (
            <div className="py-4">
              <div className="text-5xl mb-3">❌</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Invalid invite</h2>
              <p className="text-gray-500 text-sm mb-6">This invite link is not valid. It may have been removed by the group admin.</p>
              <a href="/dashboard" className="text-indigo-600 font-medium text-sm">Go to Guildly →</a>
            </div>
          )}

          {state === 'error' && (
            <div className="py-4">
              <div className="text-5xl mb-3">⚠️</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h2>
              <p className="text-gray-500 text-sm mb-6">{errorMsg}</p>
              <button onClick={processInvite} className="text-indigo-600 font-medium text-sm">Try again</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
