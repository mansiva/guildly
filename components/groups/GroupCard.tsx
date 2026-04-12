'use client';

import Link from 'next/link';
import { Users, Zap } from 'lucide-react';
import ProgressBar from '@/components/ui/ProgressBar';
import { Group } from '@/types';
import { xpToLevel } from '@/lib/utils';

interface Props {
  group: Group;
  memberCount: number;
  activeQuestCount: number;
}

export default function GroupCard({ group, memberCount, activeQuestCount }: Props) {
  const { level, progress, nextLevelXp } = xpToLevel(group.xp || 0);

  return (
    <Link href={`/groups/${group.id}`} className="block bg-white rounded-3xl border border-gray-100 shadow-sm p-4 active:scale-[0.98] transition-transform">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-3xl">{group.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-gray-900 truncate">{group.name}</div>
          {group.description && <p className="text-xs text-gray-500 truncate">{group.description}</p>}
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-bold text-indigo-600">Lv {level}</div>
          <div className="text-xs text-gray-400">{(group.xp || 0).toLocaleString()} XP</div>
        </div>
      </div>

      {/* XP progress bar */}
      <div className="mb-3">
        <ProgressBar value={progress} max={nextLevelXp} color="bg-gradient-to-r from-indigo-500 to-purple-500" />
        <p className="text-xs text-gray-400 mt-0.5 text-right">{progress} / {nextLevelXp} to Level {level + 1}</p>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Users size={13} className="text-gray-400" />
          <span>{memberCount} {memberCount === 1 ? 'member' : 'members'}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Zap size={13} className="text-indigo-400" />
          <span>{activeQuestCount} active {activeQuestCount === 1 ? 'quest' : 'quests'}</span>
        </div>
      </div>
    </Link>
  );
}
