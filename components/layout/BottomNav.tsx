'use client';

import { usePathname } from 'next/navigation';
import { Home, Bell, UserRound, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useUnreadNotifications } from '@/hooks/useNotifications';

interface Props {
  onNotifClick?: () => void;
}

export default function BottomNav({ onNotifClick }: Props) {
  const pathname = usePathname();
  const { user } = useAuth();
  const unread = useUnreadNotifications(user?.uid ?? null);

  const NAV_ITEMS = [
    { href: '/dashboard', icon: Home, label: 'Home', onClick: undefined },
    {
      href: '/notifications',
      icon: Bell,
      label: 'Notifications',
      onClick: onNotifClick,
      badge: unread > 0,
    },
    { href: '/friends', icon: UserRound, label: 'Friends', onClick: undefined },
    { href: '/profile', icon: User, label: 'Profile', onClick: undefined },
  ];

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white border-t border-gray-100 pb-safe z-50">
      <div className="flex">
        {NAV_ITEMS.map(({ href, icon: Icon, label, onClick, badge }) => {
          const active = href === '/notifications'
            ? false
            : pathname === href || pathname.startsWith(href + '/');
          return (
            <button
              key={href}
              onClick={onClick ?? (() => { window.location.href = href; })}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 py-3 transition-colors relative',
                active ? 'text-indigo-600' : 'text-gray-400'
              )}
            >
              <div className="relative">
                <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
                {badge && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
                )}
              </div>
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
