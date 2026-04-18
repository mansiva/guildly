'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { Badge } from '@/types';
import BadgeDetailSheet from './BadgeDetailSheet';

interface BadgeGridProps {
  badges: (Badge & { tier?: number })[];
  userData?: {
    logsCount?: number;
    questsCompleted?: number;
    questsLed?: number;
    nudgesGiven?: number;
  } | null;
  /** If false, tapping a badge won't open the detail sheet (e.g. viewing another user's profile) */
  interactive?: boolean;
}

export default function BadgeGrid({ badges, userData, interactive = true }: BadgeGridProps) {
  const [selectedBadge, setSelectedBadge] = useState<(Badge & { tier?: number }) | null>(null);

  if (badges.length === 0) {
    return (
      <div className="bg-white rounded-3xl p-6 text-center border border-dashed border-gray-200">
        <p className="text-gray-400 text-sm">No badges earned yet</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-4 gap-3">
        {badges.map((badge) => {
          const badgeTier = badge.tier ?? (parseInt(badge.id.split('_').pop() || '1', 10) || 1);
          return (
            <button
              key={badge.id}
              onClick={() => interactive && setSelectedBadge(badge)}
              className={`flex flex-col items-center gap-1 transition-transform ${interactive ? 'active:scale-95' : 'cursor-default'}`}
            >
              <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-2xl">
                {badge.emoji}
              </div>
              <span className="text-xs text-center text-gray-600 leading-tight">{badge.name}</span>
              <div className="flex gap-0.5">
                {[1, 2, 3].map(t => (
                  <span key={t} className={`text-[10px] ${t <= badgeTier ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {interactive && selectedBadge && (
        <BadgeDetailSheet
          badge={selectedBadge}
          userData={userData}
          onClose={() => setSelectedBadge(null)}
        />
      )}
    </>
  );
}
