import { cn } from '@/lib/utils';
import { Badge as BadgeType } from '@/types';

interface BadgeProps {
  badge: BadgeType;
  size?: 'sm' | 'md' | 'lg';
}

export default function BadgeChip({ badge, size = 'md' }: BadgeProps) {
  const sizes = {
    sm: 'text-xl p-2',
    md: 'text-3xl p-3',
    lg: 'text-4xl p-4',
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={cn('bg-indigo-50 rounded-2xl', sizes[size])}>
        {badge.emoji}
      </div>
      {size !== 'sm' && (
        <span className="text-xs font-medium text-gray-600 text-center">{badge.name}</span>
      )}
    </div>
  );
}
