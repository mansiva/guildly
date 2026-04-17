'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface NotificationContextValue {
  notifOpen: boolean;
  openNotif: () => void;
  closeNotif: () => void;
}

const NotificationContext = createContext<NotificationContextValue>({
  notifOpen: false,
  openNotif: () => {},
  closeNotif: () => {},
});

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifOpen, setNotifOpen] = useState(false);
  const openNotif = useCallback(() => setNotifOpen(true), []);
  const closeNotif = useCallback(() => setNotifOpen(false), []);
  return (
    <NotificationContext.Provider value={{ notifOpen, openNotif, closeNotif }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationSheet() {
  return useContext(NotificationContext);
}
