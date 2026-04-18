'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { NotificationProvider, useNotificationSheet } from '@/context/NotificationContext';
import BottomNav from './BottomNav';
import NotificationSheet from '@/components/notifications/NotificationSheet';
import QuestCompletionWatcher from '@/components/quests/QuestCompletionWatcher';
import QuestCompleteOverlay from '@/components/quests/QuestCompleteOverlay';

function ShellInner({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { notifOpen, openNotif, closeNotif, overlayQueue, dismissOverlay } = useNotificationSheet();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-4xl animate-pulse">⚡</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {children}
      <BottomNav onNotifClick={openNotif} />
      <NotificationSheet uid={user.uid} open={notifOpen} onClose={closeNotif} />
      <QuestCompletionWatcher uid={user.uid} />
      {overlayQueue.length > 0 && (
        <QuestCompleteOverlay {...overlayQueue[0]} onDismiss={dismissOverlay} />
      )}
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <NotificationProvider>
      <ShellInner>{children}</ShellInner>
    </NotificationProvider>
  );
}
