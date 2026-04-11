'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import Image from 'next/image';
import { Users } from 'lucide-react';

type State = 'loading' | 'preview' | 'joining' | 'joined' | 'error' | 'used' | 'expired';

export default function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [state, setState] = useState<State>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [group, setGroup] = useState<{ id: string; name: string; emoji: string; memberCount: number; description?: string } | null>(null);
  const [inviteId, setInviteId] = useState('');

  useEffect(() => {
    if (authLoading) return;
    loadInvite();
  }, [code, authLoading]);

  async function loadInvite() {
    try {
      const inviteRef = doc(db, 'invites', code.toUpperCase());
      const inviteDoc = await getDoc(inviteRef);

      if (!inviteDoc.exists()) {
        setErrorMsg('This invite link is invalid or has expired.');
        setState('error');
        return;
      }

      const invite = inviteDoc.data();
      setInviteId(inviteDoc.id);

      if (invite.used) {
        setState('used');
        return;
      }

      if (invite.expiresAt && invite.expiresAt.toDate() < new Date()) {
        setState('expired');
        return;
      }

      // Load group info
      const groupSnap = await getDoc(doc(db, 'groups', invite.groupId));
      if (!groupSnap.exists()) {
        setErrorMsg('This group no longer exists.');
        setState('error');
        return;
      }

      const groupData = groupSnap.data();

      // Already a member? Check groupMembers collection
      if (user) {
        const memberSnap = await getDoc(doc(db, 'groupMembers', `${groupSnap.id}_${user.uid}`));
        if (memberSnap.exists()) {
          router.replace(`/groups/${groupSnap.id}`);
          return;
        }
      }

      setGroup({
        id: groupSnap.id,
        name: groupData.name,
        emoji: groupData.emoji,
        memberCount: 0,
        description: groupData.description,
      });
      setState('preview');
    } catch (e) {
      console.error(e);
      setErrorMsg('Something went wrong. Please try again.');
      setState('error');
    }
  }

  async function handleJoin() {
    if (!user || !group) {
      router.push(`/login?redirect=/join/${code}`);
      return;
    }

    setState('joining');
    try {
      const inviteRef = doc(db, 'invites', inviteId);
      const inviteSnap = await getDoc(inviteRef);
      const invite = inviteSnap.data()!;

      if (invite.used) { setState('used'); return; }

      // Mark invite as used
      await updateDoc(inviteRef, {
        used: true,
        usedBy: user.uid,
        usedAt: serverTimestamp(),
      });

      // Add user to groupMembers
      await setDoc(doc(db, 'groupMembers', `${group.id}_${user.uid}`), {
        groupId: group.id,
        userId: user.uid,
        role: 'member',
        joinedAt: serverTimestamp(),
      });

      setState('joined');
      setTimeout(() => router.replace(`/groups/${group.id}`), 1500);
    } catch (e) {
      console.error(e);
      setErrorMsg('Failed to join. Please try again.');
      setState('error');
    }
  }

  useEffect(() => {
    if (state === 'preview' && !authLoading && !user) {
      // Stay on page — show "Sign in to join" button
    }
  }, [state, user, authLoading]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Image src="/logo.png" alt="Guildly" width={72} height={72} className="mx-auto mb-2 drop-shadow-xl" />
          <span className="text-white font-bold text-xl">Guildly</span>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-6 text-center">
          {(state === 'loading') && (
            <div className="py-8 text-4xl animate-pulse">⚡</div>
          )}

          {state === 'preview' && group && (
            <>
              <div className="text-6xl mb-3">{group.emoji}</div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">{group.name}</h1>
              {group.description && <p className="text-gray-500 text-sm mb-3">{group.description}</p>}

              <p className="text-gray-500 text-sm mb-6">You've been invited to join this group on Guildly.</p>
              <button onClick={handleJoin}
                className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl text-base shadow-lg active:scale-95 transition-transform">
                {user ? `Join ${group.name}` : 'Sign in to Join'}
              </button>
              <p className="text-xs text-gray-400 mt-4">
                By joining you agree to our <a href="/terms" className="text-indigo-500 underline">Terms</a>
              </p>
            </>
          )}

          {state === 'joining' && (
            <div className="py-8">
              <div className="text-4xl animate-pulse mb-3">⚡</div>
              <p className="text-gray-600 font-medium">Joining {group?.name}...</p>
            </div>
          )}

          {state === 'joined' && (
            <div className="py-8">
              <div className="text-5xl mb-3">🎉</div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">You're in!</h2>
              <p className="text-gray-500 text-sm">Taking you to {group?.name}...</p>
            </div>
          )}

          {state === 'used' && (
            <div className="py-8">
              <div className="text-5xl mb-3">🔒</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Link already used</h2>
              <p className="text-gray-500 text-sm mb-6">This invite link has already been used. Ask your group admin for a new one.</p>
              <a href="/" className="text-indigo-600 font-medium text-sm">Go to Guildly →</a>
            </div>
          )}

          {state === 'expired' && (
            <div className="py-8">
              <div className="text-5xl mb-3">⏰</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Link expired</h2>
              <p className="text-gray-500 text-sm mb-6">This invite has expired. Ask your group admin for a fresh link.</p>
              <a href="/" className="text-indigo-600 font-medium text-sm">Go to Guildly →</a>
            </div>
          )}

          {state === 'error' && (
            <div className="py-8">
              <div className="text-5xl mb-3">❌</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Invalid invite</h2>
              <p className="text-gray-500 text-sm mb-6">{errorMsg}</p>
              <a href="/" className="text-indigo-600 font-medium text-sm">Go to Guildly →</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
