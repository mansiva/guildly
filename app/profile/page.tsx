'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { doc, onSnapshot, updateDoc, deleteField } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import AppShell from '@/components/layout/AppShell';
import UserAvatar from '@/components/ui/UserAvatar';
import XPCard from '@/components/profile/XPCard';
import BadgeGrid from '@/components/profile/BadgeGrid';
import { xpToLevel } from '@/lib/utils';
import { LogOut, Star, Pencil, Check, X, Bell, BellOff, Download } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/types';
import { requestNotificationPermission } from '@/lib/messaging';

const LEVEL_TITLES = [
  'Newcomer', 'Initiate', 'Seeker', 'Trailblazer', 'Challenger',
  'Pathfinder', 'Achiever', 'Champion', 'Hero', 'Legend',
];

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [userData, setUserData] = useState<{
    displayName: string; xp: number; level: number; badges: Badge[]; fcmToken?: string;
    logsCount?: number; questsCompleted?: number; questsLed?: number; nudgesGiven?: number;
  } | null>(null);

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [togglingNotif, setTogglingNotif] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) setUserData(snap.data() as typeof userData);
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches);
    const handler = (e: Event) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function handleInstall() {
    if (!installPrompt) return;
    setInstalling(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (installPrompt as any).prompt();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { outcome } = await (installPrompt as any).userChoice;
      if (outcome === 'accepted') { setInstallPrompt(null); setIsStandalone(true); }
    } finally { setInstalling(false); }
  }

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
      // Clear dismissed flag so setup panel reappears on dashboard
      localStorage.removeItem('setup-panel-dismissed');
    } finally {
      setTogglingNotif(false);
    }
  }

  const xp = userData?.xp || 0;
  const { level } = xpToLevel(xp);
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
        <XPCard xp={xp} />

        {/* Badges */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Star size={18} className="text-yellow-500" />
            <h2 className="font-bold text-gray-900">Badges ({badges.length})</h2>
          </div>
          <BadgeGrid badges={badges} userData={userData} />
        </div>

        {/* Install app */}
        {!isStandalone && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Download size={18} className="text-indigo-500" />
              <h2 className="font-bold text-gray-900">Install App</h2>
            </div>
            <div className="bg-white rounded-3xl p-4 border border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Add to home screen</p>
                <p className="text-xs text-gray-400 mt-0.5">Faster access, full-screen experience</p>
              </div>
              {installPrompt ? (
                <button
                  onClick={handleInstall}
                  disabled={installing}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium disabled:opacity-50 active:scale-95 transition-transform"
                >
                  <Download size={15} />
                  {installing ? 'Installing…' : 'Install'}
                </button>
              ) : (
                <span className="text-xs text-gray-400">Open in Chrome</span>
              )}
            </div>
          </div>
        )}

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

    </AppShell>
  );
}
