'use client';

import ProgressBar from '@/components/ui/ProgressBar';
import { xpToLevel } from '@/lib/utils';

const LEVEL_TITLES = [
  'Newcomer', 'Initiate', 'Seeker', 'Trailblazer', 'Challenger',
  'Pathfinder', 'Achiever', 'Champion', 'Hero', 'Legend',
];

interface XPCardProps {
  xp: number;
}

export default function XPCard({ xp }: XPCardProps) {
  const { level, progress, nextLevelXp } = xpToLevel(xp);
  const title = LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)];

  return (
    <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl p-5 text-white mb-6">
      <div className="flex items-center justify-between mb-1">
        <p className="text-indigo-200 text-xs font-medium">{title}</p>
      </div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-indigo-200 text-sm">Total XP</p>
          <p className="text-3xl font-bold">{xp.toLocaleString()}</p>
        </div>
        <div className="text-right">
          <p className="text-indigo-200 text-sm">Level</p>
          <p className="text-4xl font-bold">{level}</p>
        </div>
      </div>
      <ProgressBar
        value={progress}
        max={nextLevelXp}
        color="bg-white/90"
        trackColor="bg-white/20"
      />
      <p className="text-indigo-200 text-xs mt-1 text-right">{progress} / {nextLevelXp} to Level {level + 1}</p>
    </div>
  );
}
