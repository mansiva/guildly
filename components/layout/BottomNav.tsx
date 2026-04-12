'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, UserRound, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/dashboard', icon: Home, label: 'Home' },
  { href: '/groups', icon: Users, label: 'Groups' },
  { href: '/friends', icon: UserRound, label: 'Friends' },
  { href: '/profile', icon: User, label: 'Profile' },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white border-t border-gray-100 pb-safe z-50">
      <div className="flex">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 py-3 transition-colors',
                active ? 'text-indigo-600' : 'text-gray-400'
              )}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
