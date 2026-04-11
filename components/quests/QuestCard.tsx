'use client';

import { useState } from 'react';
import { Quest } from '@/types';
import ProgressBar from '@/components/ui/ProgressBar';
import { CATEGORY_COLORS, CATEGORY_LABELS } from '@/lib/quest-templates';
import { cn } from '@/lib/utils';
import LogProgressModal from './LogProgressModal';

interface QuestCardProps {
  quest: Quest;
  userId: string;
  groupId: string;
}

export default function QuestCard({ quest, userId, groupId }: QuestCardProps) {
  const [showLog, setShowLog] = useState(false);
  const pct = Math.min(100, Math.round((quest.currentValue / quest.targetValue) * 100));
  const myContrib = quest.contributions?.[userId] || 0;
  const daysLeft = Math.max(0, Math.ceil((new Date(quest.deadline).getTime() - Date.now()) / 86400000));
  const completed = quest.status === 'completed';

  return (
    <>
      <div className={cn(
        'bg-white rounded-3xl p-4 shadow-sm border',
        completed ? 'border-green-200 bg-green-50' : 'border-gray-100'
      )}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', CATEGORY_COLORS[quest.category])}>
                {CATEGORY_LABELS[quest.category]}
              </span>
              {completed && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">✓ Done</span>}
            </div>
            <h3 className="font-bold text-gray-900">{quest.title}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{quest.description}</p>
          </div>
          <div className="text-right ml-3">
            <div className="text-lg font-bold text-indigo-600">+{quest.xpReward} XP</div>
            {!completed && <div className="text-xs text-gray-400">{daysLeft}d left</div>}
          </div>
        </div>

        <ProgressBar value={quest.currentValue} max={quest.targetValue} showLabel />

        <div className="flex items-center justify-between mt-3">
          <div className="text-xs text-gray-500">
            Your contribution: <span className="font-semibold text-gray-700">{myContrib} {quest.unit}</span>
          </div>
          {!completed && quest.status === 'active' && (
            <button
              onClick={() => setShowLog(true)}
              className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-xl active:scale-95 transition-transform"
            >
              Log Progress
            </button>
          )}
        </div>
      </div>

      {showLog && (
        <LogProgressModal
          quest={quest}
          userId={userId}
          groupId={groupId}
          onClose={() => setShowLog(false)}
        />
      )}
    </>
  );
}
