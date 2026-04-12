'use client';

import { xpToLevel } from '@/lib/utils';

interface UserAvatarProps {
  photoURL?: string | null;
  displayName?: string | null;
  xp?: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showLevel?: boolean;
  className?: string;
}

const SIZE_MAP = {
  sm:  { outer: 'w-8 h-8',   text: 'text-sm',  badge: 'text-[9px] px-1 min-w-[16px] h-[16px] -bottom-0.5 -right-1' },
  md:  { outer: 'w-10 h-10', text: 'text-base', badge: 'text-[9px] px-1 min-w-[18px] h-[18px] -bottom-0.5 -right-1' },
  lg:  { outer: 'w-12 h-12', text: 'text-lg',   badge: 'text-[10px] px-1.5 min-w-[20px] h-[20px] -bottom-0.5 -right-1' },
  xl:  { outer: 'w-20 h-20', text: 'text-3xl',  badge: 'text-xs px-1.5 min-w-[22px] h-[22px] -bottom-0 -right-0.5' },
};

export default function UserAvatar({ photoURL, displayName, xp, size = 'md', showLevel = true, className = '' }: UserAvatarProps) {
  const s = SIZE_MAP[size];
  const { level } = xpToLevel(xp ?? 0);
  const initial = displayName?.[0]?.toUpperCase() || '?';

  return (
    <div className={`relative shrink-0 ${className}`}>
      <div className={`${s.outer} rounded-full bg-indigo-100 flex items-center justify-center overflow-hidden`}>
        {photoURL
          ? <img src={photoURL} alt={displayName || ''} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          : <span className={`${s.text} font-bold text-indigo-600 leading-none`}>{initial}</span>
        }
      </div>
      {showLevel && xp !== undefined && (
        <div className={`absolute ${s.badge} bg-indigo-600 text-white font-bold rounded-full flex items-center justify-center leading-none`}>
          {level}
        </div>
      )}
    </div>
  );
}
