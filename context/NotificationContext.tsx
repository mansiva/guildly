'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface QuestOverlayData {
  questTitle: string;
  unit: string;
  targetValue: number;
  totalXp: number;
  contributions: {
    uid: string;
    displayName: string;
    photoURL?: string;
    xp: number;
    contributed: number;
    pct: number;
    xpEarned: number;
    isTop: boolean;
    isMe: boolean;
  }[];
}

interface NotificationContextValue {
  notifOpen: boolean;
  openNotif: () => void;
  closeNotif: () => void;
  overlayQueue: QuestOverlayData[];
  pushOverlay: (data: QuestOverlayData) => void;
  dismissOverlay: () => void;
}

const NotificationContext = createContext<NotificationContextValue>({
  notifOpen: false,
  openNotif: () => {},
  closeNotif: () => {},
  overlayQueue: [],
  pushOverlay: () => {},
  dismissOverlay: () => {},
});

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [overlayQueue, setOverlayQueue] = useState<QuestOverlayData[]>([]);

  const openNotif = useCallback(() => setNotifOpen(true), []);
  const closeNotif = useCallback(() => setNotifOpen(false), []);
  const pushOverlay = useCallback((data: QuestOverlayData) => {
    setOverlayQueue(prev => [...prev, data]);
  }, []);
  const dismissOverlay = useCallback(() => {
    setOverlayQueue(prev => prev.slice(1));
  }, []);

  return (
    <NotificationContext.Provider value={{ notifOpen, openNotif, closeNotif, overlayQueue, pushOverlay, dismissOverlay }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationSheet() {
  return useContext(NotificationContext);
}
