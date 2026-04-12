'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import AppShell from '@/components/layout/AppShell';
import ProgressBar from '@/components/ui/ProgressBar';
import UserAvatar from '@/components/ui/UserAvatar';
import { xpToLevel } from '@/lib/utils';
import { LogOut, Star, Pencil, Check, X } from 'lucide-react';
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
    displayName: string; xp: number; level: number; badges: Badge[]; username?: string;
  } | null>(null);

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState('');

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

  async function saveUsername() {
    if (!user || !usernameInput.trim()) return;
    setSavingUsername(true); setUsernameError('');
    try {
      const { getDocs, query, collection: col, where } = await import('firebase/firestore');
      const clean = usernameInput.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (clean.length < 3) { setUsernameError('At least 3 characters'); setSavingUsername(false); return; }
      // Check uniqueness
      const snap = await getDocs(query(col(db, 'users'), where('username', '==', clean)));
      if (!snap.empty && snap.docs[0].id !== user.uid) { setUsernameError('Username taken'); setSavingUsername(false); return; }
      await updateDoc(doc(db, 'users', user.uid), { username: clean });
      setEditingUsername(false);
    } finally { setSavingUsername(false); }
  }

  const xp = userData?.xp || 0;
  const { level, progress, nextLevelXp } = xpToLevel(xp);
  const title = LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)];
  const badges = userData?.badges || [];
  const displayName = userData?.displayName || user?.displayName || '';

  return (
    <AppShell>
      <div className="px-4 pt-6">
        {/* Avatar + name */}
        <div className="flex flex-col items-center mb-8 pt-4">
          <UserAvatar
            photoURL={user?.photoURL}
            displayName={displayName}
            xp={xp}
            size="xl"
            className="mb-4"
          />

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

          {/* Username */}
          {editingUsername ? (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-gray-400 text-sm">@</span>
              <input
                value={usernameInput}
                onChange={e => setUsernameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                maxLength={20} autoFocus
                onKeyDown={e => { if (e.key === 'Enter') saveUsername(); if (e.key === 'Escape') setEditingUsername(false); }}
                placeholder="username"
                className="px-3 py-1.5 bg-gray-100 text-gray-900 rounded-xl text-sm text-center outline-none focus:ring-2 focus:ring-indigo-300 w-36"
              />
              <button onClick={saveUsername} disabled={savingUsername || !usernameInput.trim()}
                className="p-1.5 rounded-full bg-indigo-600 text-white disabled:opacity-50"><Check size={14} /></button>
              <button onClick={() => { setEditingUsername(false); setUsernameError(''); }}
                className="p-1.5 rounded-full bg-gray-100"><X size={14} className="text-gray-500" /></button>
            </div>
          ) : (
            <button onClick={() => { setUsernameInput(userData?.username || ''); setEditingUsername(true); setUsernameError(''); }}
              className="flex items-center gap-1 mt-1.5 group">
              <span className="text-sm text-gray-400">
                {userData?.username ? `@${userData.username}` : 'Set username'}
              </span>
              <Pencil size={12} className="text-gray-300 group-hover:text-indigo-400 transition-colors" />
            </button>
          )}
          {usernameError && <p className="text-xs text-red-500 mt-1">{usernameError}</p>}
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
