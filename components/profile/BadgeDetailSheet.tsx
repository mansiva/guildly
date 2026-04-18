'use client';

import { X } from 'lucide-react';
import { Badge } from '@/types';
import { BADGE_DEFS } from '@/lib/badges';

function formatDate(date: Date | { seconds: number } | string | null | undefined): string {
  if (!date) return '';
  let d: Date;
  if (date instanceof Date) {
    d = date;
  } else if (typeof date === 'object' && 'seconds' in date) {
    d = new Date((date as { seconds: number }).seconds * 1000);
  } else {
    d = new Date(date as string);
  }
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

interface BadgeDetailSheetProps {
  badge: Badge & { tier?: number };
  userData?: {
    logsCount?: number;
    questsCompleted?: number;
    questsLed?: number;
    nudgesGiven?: number;
  } | null;
  onClose: () => void;
}

export default function BadgeDetailSheet({ badge, userData, onClose }: BadgeDetailSheetProps) {
  const parsedTier = parseInt(badge.id.split('_').pop() || '1', 10) || 1;
  const tier = badge.tier ?? parsedTier;

  const prefix = badge.id.replace(/_\d+$/, '');
  const thisTierDef = BADGE_DEFS.find(b => b.id === `${prefix}_${tier}`);
  const nextTierDef = BADGE_DEFS.find(b => b.id === `${prefix}_${tier + 1}`);

  const statKey = (nextTierDef ?? thisTierDef)?.stat;
  const currentStat = statKey && userData ? (userData[statKey as keyof typeof userData] as number) || 0 : 0;
  const targetThreshold = nextTierDef ? nextTierDef.threshold : (thisTierDef?.threshold ?? 1);
  const progressPct = nextTierDef
    ? Math.min(Math.round((currentStat / targetThreshold) * 100), 99)
    : 100;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-end bg-black/50">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full max-w-[480px] bg-white rounded-t-3xl px-5 pt-5 overflow-y-auto pb-16">
        <div className="flex justify-end mb-2">
          <button onClick={onClose} className="p-2 rounded-full bg-gray-100">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="flex flex-col items-center mb-4">
          <span className="text-5xl mb-3">{badge.emoji}</span>
          <h2 className="font-bold text-xl text-gray-900 text-center">{badge.name}</h2>
          <div className="flex items-center gap-1 mt-2">
            {[1, 2, 3].map((t) => (
              <span key={t} className={`text-sm ${t <= tier ? 'text-yellow-400' : 'text-gray-300'}`}>★</span>
            ))}
            <span className="text-xs text-gray-500 ml-1">Tier {tier} / 3</span>
          </div>
        </div>

        <div className="bg-gray-50 rounded-2xl p-4 mb-4">
          <p className="text-sm text-gray-700 text-center">{badge.description}</p>
        </div>

        {badge.earnedAt && (
          <p className="text-xs text-gray-400 text-center mb-4">
            Earned: {formatDate(badge.earnedAt as unknown as Date | { seconds: number })}
          </p>
        )}

        <div className="bg-indigo-50 rounded-2xl p-4">
          {nextTierDef ? (
            <>
              <p className="text-xs font-semibold text-indigo-600 mb-1">Next tier: {nextTierDef.name}</p>
              <p className="text-xs text-indigo-700 mb-3">{nextTierDef.description}</p>
              <div className="w-full bg-indigo-200 rounded-full h-2 mb-1">
                <div
                  className="bg-indigo-600 h-2 rounded-full transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-xs text-indigo-500 text-right">{currentStat} / {targetThreshold}</p>
            </>
          ) : (
            <>
              <p className="text-sm text-indigo-700 font-medium text-center mb-3">Max tier reached 🏆</p>
              <div className="w-full bg-indigo-200 rounded-full h-2">
                <div className="bg-indigo-600 h-2 rounded-full w-full" />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
