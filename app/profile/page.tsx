'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { doc, onSnapshot, updateDoc, deleteField } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import AppShell from '@/components/layout/AppShell';
import ProgressBar from '@/components/ui/ProgressBar';
import UserAvatar from '@/components/ui/UserAvatar';
import { xpToLevel } from '@/lib/utils';
import { LogOut, Star, Pencil, Check, X, Bell, BellOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/types';
import { BADGE_DEFS } from '@/lib/badges';
import { requestNotificationPermission } from '@/lib/messaging';

const LEVEL_TITLES = [
  'Newcomer', 'Initiate', 'Seeker', 'Trailblazer', 'Challenger',
  'Pathfinder', 'Achiever', 'Champion', 'Hero', 'Legend',
];

function formatDate(date: Date | { seconds: number } | string | null | undefined): string {
  if (!date) return '';
  let d: Date;
  if (date instanceof Date) {
    d = date;
  } else if (typeof date === 'object' && 'seconds' in date) {
    d = new Date((date as { seconds: number }).seconds * 1000);
  } else {
    d = new Date(date as string);
  }
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

interface BadgeSheetProps {
  badge: Badge & { tier?: number };
  onClose: () => void;
}

function BadgeDetailSheet({ badge, onClose }: BadgeSheetProps) {
  // Determine tier: from stored tier field, or parse from id suffix
  const parsedTier = parseInt(badge.id.split('_').pop() || '1', 10) || 1;
  const tier = badge.tier ?? parsedTier;

  // Find the next tier badge def
  const prefix = badge.id.replace(/_\d+$/, '');
  const nextTierDef = BADGE_DEFS.find(b => b.id === `${prefix}_${tier + 1}`);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-end bg-black/50">
      {/* Backdrop tap to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Sheet */}
      <div className="relative w-full max-w-[480px] bg-white rounded-t-3xl px-5 pt-5 overflow-y-auto pb-16">
        {/* Close button */}
        <div className="flex justify-end mb-2">
          <button onClick={onClose} className="p-2 rounded-full bg-gray-100">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Emoji */}
        <div className="flex flex-col items-center mb-4">
          <span className="text-5xl mb-3">{badge.emoji}</span>
          <h2 className="font-bold text-xl text-gray-900 text-center">{badge.name}</h2>

          {/* Tier indicator */}
          <div className="flex items-center gap-1 mt-2">
            {[1, 2, 3].map((t) => (
              <span
                key={t}
                className={`text-sm ${t <= tier ? 'text-yellow-400' : 'text-gray-300'}`}
              >
                ★
              </span>
            ))}
            <span className="text-xs text-gray-500 ml-1">Tier {tier} / 3</span>
          </div>
        </div>

        {/* Description */}
        <div className="bg-gray-50 rounded-2xl p-4 mb-4">
          <p className="text-sm text-gray-700 text-center">{badge.description}</p>
        </div>

        {/* Earned date */}
        {badge.earnedAt && (
          <p className="text-xs text-gray-400 text-center mb-4">
            Earned: {formatDate(badge.earnedAt as unknown as Date | { seconds: number })}
          </p>
        )}

        {/* Next tier info */}
        <div className="bg-indigo-50 rounded-2xl p-4">
          {nextTierDef ? (
            <>
              <p className="text-xs font-semibold text-indigo-600 mb-1">Next tier</p>
              <p className="text-sm text-indigo-900 font-medium">{nextTierDef.name}</p>
              <p className="text-xs text-indigo-700 mt-0.5">
                {nextTierDef.description} — {nextTierDef.threshold} {nextTierDef.stat}
              </p>
            </>
          ) : (
            <p className="text-sm text-indigo-700 font-medium text-center">Max tier reached 🏆</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [userData, setUserData] = useState<{
    displayName: string; xp: number; level: number; badges: Badge[]; fcmToken?: string;
  } | null>(null);

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState<(Badge & { tier?: number }) | null>(null);
  const [togglingNotif, setTogglingNotif] = useState(false);

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

  function startEditName() {
    setNameInput(userData?.displayName || user?.displayName || '');
    setEditingName(true);
  }

  async function saveName() {
    if (!user || !nameInput.trim()) return;
    setSavingName(true);
    try {
      const name = nameInput.trim();
      await updateDoc(doc(db, 'users', user.uid), { displayName: name, displayNameLower: name.toLowerCase() });
      setEditingName(false);
    } finally { setSavingName(false); }
  }

  async function handleEnableNotifications() {
    if (!user) return;
    setTogglingNotif(true);
    try {
      const result = await requestNotificationPermission(user.uid);
      if (result.status === 'denied') {
        alert('Notifications blocked. Please enable them in your browser settings.');
      } else if (result.status === 'error') {
        alert('Could not enable notifications: ' + result.message);
      }
    } finally {
      setTogglingNotif(false);
    }
  }

  async function handleDisableNotifications() {
    if (!user) return;
    setTogglingNotif(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { fcmToken: deleteField() });
    } finally {
      setTogglingNotif(false);
    }
  }

  const xp = userData?.xp || 0;
  const { level, progress, nextLevelXp } = xpToLevel(xp);
  const title = LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)];
  const badges = (userData?.badges || []) as (Badge & { tier?: number })[];
  const displayName = userData?.displayName || user?.displayName || '';
  const notificationsEnabled = !!userData?.fcmToken;

  if (!user) return (
    <AppShell><div className="flex items-center justify-center h-64"><div className="text-3xl animate-pulse">⚡</div></div></AppShell>
  );

  return (
    <AppShell>
      <div className="px-4 pt-6">
        {/* Avatar + name */}
        <div className="flex flex-col items-center mb-8 pt-4">
          <UserAvatar photoURL={user?.photoURL} displayName={displayName} xp={xp} size="xl" className="mb-4" />

          {editingName ? (
            <div className="flex items-center gap-2 mt-1">
              <input
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                maxLength={40}
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
                className="px-3 py-2 bg-gray-100 text-gray-900 rounded-xl text-lg font-bold text-center outline-none focus:ring-2 focus:ring-indigo-300 w-48"
              />
              <button onClick={saveName} disabled={savingName || !nameInput.trim()}
                className="p-2 rounded-full bg-indigo-600 text-white disabled:opacity-50">
                <Check size={16} />
              </button>
              <button onClick={() => setEditingName(false)} className="p-2 rounded-full bg-gray-100">
                <X size={16} className="text-gray-500" />
              </button>
            </div>
          ) : (
            <button onClick={startEditName} className="flex items-center gap-2 group mt-1">
              <h1 className="text-2xl font-bold text-gray-900">{displayName}</h1>
              <Pencil size={15} className="text-gray-400 group-hover:text-indigo-500 transition-colors" />
            </button>
          )}

          <p className="text-indigo-600 font-semibold mt-1">{title}</p>
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
          <ProgressBar
            value={progress}
            max={nextLevelXp}
            color="bg-white/90"
            trackColor="bg-white/20"
          />
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
                <button
                  key={badge.id}
                  onClick={() => setSelectedBadge(badge)}
                  className="flex flex-col items-center gap-1 active:scale-95 transition-transform"
                >
                  <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-2xl">
                    {badge.emoji}
                  </div>
                  <span className="text-xs text-center text-gray-600 leading-tight">{badge.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Bell size={18} className="text-indigo-500" />
            <h2 className="font-bold text-gray-900">Notifications</h2>
          </div>
          <div className="bg-white rounded-3xl p-4 border border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">
                {notificationsEnabled ? 'Enabled' : 'Disabled'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {notificationsEnabled
                  ? 'You\'ll receive push notifications'
                  : 'Enable to get quest & badge alerts'}
              </p>
            </div>
            {notificationsEnabled ? (
              <button
                onClick={handleDisableNotifications}
                disabled={togglingNotif}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-medium disabled:opacity-50 active:scale-95 transition-transform"
              >
                <BellOff size={15} />
                Disable
              </button>
            ) : (
              <button
                onClick={handleEnableNotifications}
                disabled={togglingNotif}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium disabled:opacity-50 active:scale-95 transition-transform"
              >
                <Bell size={15} />
                Enable
              </button>
            )}
          </div>
        </div>

        {/* Sign out */}
        <button onClick={handleLogout}
          className="w-full py-3 flex items-center justify-center gap-2 border border-red-200 text-red-500 rounded-2xl text-sm font-medium mb-8 active:scale-95 transition-transform">
          <LogOut size={16} /> Sign Out
        </button>
      </div>

      {/* Badge detail bottom sheet */}
      {selectedBadge && (
        <BadgeDetailSheet badge={selectedBadge} onClose={() => setSelectedBadge(null)} />
      )}
    </AppShell>
  );
}
