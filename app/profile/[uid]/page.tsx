'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { doc, onSnapshot, getDocs, query, collection, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import AppShell from '@/components/layout/AppShell';
import UserAvatar from '@/components/ui/UserAvatar';
import XPCard from '@/components/profile/XPCard';
import BadgeGrid from '@/components/profile/BadgeGrid';
import { followUser, unfollowUser } from '@/app/friends/page';
import { xpToLevel } from '@/lib/utils';
import { ChevronLeft, Star, UserCheck, UserPlus, UserMinus } from 'lucide-react';
import { Badge } from '@/types';

const LEVEL_TITLES = [
  'Newcomer', 'Initiate', 'Seeker', 'Trailblazer', 'Challenger',
  'Pathfinder', 'Achiever', 'Champion', 'Hero', 'Legend',
];

interface ViewedUserData {
  displayName: string;
  photoURL?: string;
  xp: number;
  badges: (Badge & { tier?: number })[];
  email?: string;
}

export default function UserProfilePage() {
  const { uid } = useParams<{ uid: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [viewedUser, setViewedUser] = useState<ViewedUserData | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowedBy, setIsFollowedBy] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load the viewed user's profile
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(doc(db, 'users', uid), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setViewedUser({
          displayName: d.displayName ?? 'Unknown',
          photoURL: d.photoURL,
          xp: d.xp ?? 0,
          badges: d.badges ?? [],
          email: d.email,
        });
      }
      setLoading(false);
    });
    return unsub;
  }, [uid]);

  // Load follow relationship
  useEffect(() => {
    if (!user?.uid || !uid) return;
    async function loadFollowStatus() {
      const myUid = user!.uid;
      const [followingSnap, followerSnap] = await Promise.all([
        getDocs(query(collection(db, 'follows'), where('followerId', '==', myUid), where('followeeId', '==', uid))),
        getDocs(query(collection(db, 'follows'), where('followerId', '==', uid), where('followeeId', '==', myUid))),
      ]);
      setIsFollowing(!followingSnap.empty);
      setIsFollowedBy(!followerSnap.empty);
    }
    loadFollowStatus();
  }, [user?.uid, uid]);

  async function handleFollow() {
    if (!user?.uid || !uid) return;
    setToggling(true);
    try {
      await followUser(user.uid, uid);
      setIsFollowing(true);
    } finally { setToggling(false); }
  }

  async function handleUnfollow() {
    if (!user?.uid || !uid) return;
    setToggling(true);
    try {
      await unfollowUser(user.uid, uid);
      setIsFollowing(false);
    } finally { setToggling(false); }
  }

  const xp = viewedUser?.xp ?? 0;
  const { level } = xpToLevel(xp);
  const title = LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)];
  const isMutual = isFollowing && isFollowedBy;

  if (!user) return null;

  return (
    <AppShell>
      <div className="px-4 pt-6">
        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-indigo-600 font-medium mb-4 active:scale-95 transition-transform"
        >
          <ChevronLeft size={20} />
          Back
        </button>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-3xl animate-pulse">⚡</div>
          </div>
        ) : !viewedUser ? (
          <div className="text-center py-16 text-gray-400">User not found</div>
        ) : (
          <>
            {/* Avatar + name */}
            <div className="flex flex-col items-center mb-8 pt-2">
              <UserAvatar
                photoURL={viewedUser.photoURL}
                displayName={viewedUser.displayName}
                xp={xp}
                size="xl"
                className="mb-4"
              />
              <h1 className="text-2xl font-bold text-gray-900">{viewedUser.displayName}</h1>
              <p className="text-indigo-600 font-semibold mt-1">{title}</p>
              {isMutual && (
                <span className="mt-2 text-xs text-indigo-500 font-medium bg-indigo-50 px-2.5 py-1 rounded-full">
                  Mutual
                </span>
              )}
            </div>

            {/* XP card */}
            <XPCard xp={xp} />

            {/* Badges */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Star size={18} className="text-yellow-500" />
                <h2 className="font-bold text-gray-900">
                  Badges ({viewedUser.badges.length})
                </h2>
              </div>
              <BadgeGrid badges={viewedUser.badges} interactive={false} />
            </div>

            {/* Follow / Unfollow */}
            <div className="mb-8">
              {isFollowing ? (
                <button
                  onClick={handleUnfollow}
                  disabled={toggling}
                  className="w-full py-3 flex items-center justify-center gap-2 bg-gray-100 text-gray-700 rounded-2xl text-sm font-semibold disabled:opacity-50 active:scale-95 transition-transform"
                >
                  <UserMinus size={16} />
                  {toggling ? 'Updating…' : 'Unfollow'}
                </button>
              ) : (
                <button
                  onClick={handleFollow}
                  disabled={toggling}
                  className="w-full py-3 flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-2xl text-sm font-semibold disabled:opacity-50 active:scale-95 transition-transform"
                >
                  {isFollowedBy ? <UserCheck size={16} /> : <UserPlus size={16} />}
                  {toggling ? 'Updating…' : isFollowedBy ? 'Follow back' : 'Follow'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
