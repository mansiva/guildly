'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import AppShell from '@/components/layout/AppShell';
import ProgressBar from '@/components/ui/ProgressBar';
import UserAvatar from '@/components/ui/UserAvatar';
import { xpToLevel } from '@/lib/utils';
import { LogOut, Star } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/types';

const LEVEL_TITLES = [
  'Newcomer', 'Initiate', 'Seeker', 'Trailblazer', 'Challenger',
  'Pathfinder', 'Achiever', 'Champion', 'Hero', 'Legend',
];

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [userData, setUserData] = useState<{
    displayName: string; xp: number; level: number; badges: Badge[];
  } | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) setUserData(snap.data() as typeof userData);
    });
    return unsub;
  }, [user]);

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  const xp = userData?.xp || 0;
  const { level, progress, nextLevelXp } = xpToLevel(xp);
  const title = LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)];
  const badges = userData?.badges || [];

  return (
    <AppShell>
      <div className="px-4 pt-6">
        {/* Avatar + name */}
        <div className="flex flex-col items-center mb-8 pt-4">
          <UserAvatar
            photoURL={user?.photoURL}
            displayName={userData?.displayName || user?.displayName}
            xp={xp}
            size="xl"
            className="mb-4"
          />
          <h1 className="text-2xl font-bold text-gray-900">{userData?.displayName || user?.displayName}</h1>
          <p className="text-indigo-600 font-semibold mt-0.5">{title}</p>
          <p className="text-gray-400 text-sm">{user?.email}</p>
        </div>

        {/* XP / Level card */}
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl p-5 text-white mb-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-indigo-200 text-sm">Total XP</p>
              <p className="text-3xl font-bold">{xp.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-indigo-200 text-sm">Level</p>
              <p className="text-4xl font-bold">{level}</p>
            </div>
          </div>
          <ProgressBar value={progress} max={nextLevelXp} color="bg-white" />
          <p className="text-indigo-200 text-xs mt-1 text-right">{progress} / {nextLevelXp} to Level {level + 1}</p>
        </div>

        {/* Badges */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Star size={18} className="text-yellow-500" />
            <h2 className="font-bold text-gray-900">Badges ({badges.length})</h2>
          </div>
          {badges.length === 0 ? (
            <div className="bg-white rounded-3xl p-6 text-center border border-dashed border-gray-200">
              <p className="text-gray-400 text-sm">Complete quests to earn badges!</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {badges.map((badge) => (
                <div key={badge.id} className="flex flex-col items-center gap-1">
                  <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-2xl">
                    {badge.emoji}
                  </div>
                  <span className="text-xs text-center text-gray-600 leading-tight">{badge.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sign out */}
        <button onClick={handleLogout}
          className="w-full py-3 flex items-center justify-center gap-2 border border-red-200 text-red-500 rounded-2xl text-sm font-medium mb-8 active:scale-95 transition-transform">
          <LogOut size={16} /> Sign Out
        </button>
      </div>
    </AppShell>
  );
}
