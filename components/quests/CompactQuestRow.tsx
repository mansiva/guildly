'use client';

import { useState } from 'react';
import { Quest } from '@/types';
import { Plus, ChevronDown, ChevronUp } from 'lucide-react';
import LogProgressModal from './LogProgressModal';
import { DIFFICULTY_LABELS } from '@/lib/questXp';

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  const d = new Date(value as string | number);
  return isNaN(d.getTime()) ? null : d;
}

interface Props {
  quest: Quest;
  userId: string;
  groupId: string;
  onEdit?: (q: Quest) => void;
  /** Optional group label shown when listing quests across multiple groups */
  groupLabel?: string;
}

export default function CompactQuestRow({ quest, userId, groupId, onEdit, groupLabel }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [showLog, setShowLog] = useState(false);

  const pct = Math.min(100, Math.round((quest.currentValue / quest.targetValue) * 100));
  const deadlineDate = toDate(quest.deadline);
  const daysLeft = deadlineDate
    ? Math.max(0, Math.ceil((deadlineDate.getTime() - Date.now()) / 86400000))
    : null;
  const completed = quest.status === 'completed';
  const urgent = !completed && daysLeft !== null && daysLeft <= 1;

  return (
    <>
      <div className={`bg-white rounded-2xl border overflow-hidden ${completed ? 'border-green-200' : urgent ? 'border-orange-200' : 'border-gray-100'}`}>
        <button className="w-full flex items-center gap-3 px-4 py-3 text-left" onClick={() => setExpanded(v => !v)}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-sm font-semibold text-gray-900 truncate">{quest.title}</span>
              {completed && <span className="text-xs text-green-600 font-medium shrink-0">✓ Done</span>}
              {urgent && <span className="text-xs text-orange-500 font-medium shrink-0">⚠ Due today</span>}
              {groupLabel && <span className="text-xs text-gray-400 shrink-0">{groupLabel}</span>}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs text-gray-400 shrink-0">{pct}%</span>
              {daysLeft !== null && !completed && (
                <span className={`text-xs shrink-0 ${urgent ? 'text-orange-500 font-semibold' : 'text-gray-400'}`}>
                  {daysLeft === 0 ? 'Due today' : `${daysLeft}d left`}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!completed && (
              <button
                onClick={e => { e.stopPropagation(); setShowLog(true); }}
                className="w-8 h-8 bg-indigo-600 text-white rounded-xl flex items-center justify-center active:scale-95 transition-transform"
              >
                <Plus size={16} />
              </button>
            )}
            {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
          </div>
        </button>

        {expanded && (
          <div className="px-4 pb-4 border-t border-gray-50">
            <div className="flex items-center justify-between mt-3 mb-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-indigo-600 font-bold">+{quest.xpReward} XP</span>
                {quest.difficulty && (
                  <span className="text-xs text-gray-400">{DIFFICULTY_LABELS[quest.difficulty]}</span>
                )}
              </div>
              <span className="text-xs text-gray-500">
                My contribution: {quest.contributions?.[userId] || 0} {quest.unit}
              </span>
            </div>
            {quest.description && <p className="text-xs text-gray-500 mt-1">{quest.description}</p>}
            {onEdit && (
              <button onClick={() => onEdit(quest)} className="mt-2 text-xs text-indigo-500 font-medium">
                Edit quest
              </button>
            )}
          </div>
        )}
      </div>

      {showLog && (
        <LogProgressModal quest={quest} userId={userId} groupId={groupId} onClose={() => setShowLog(false)} />
      )}
    </>
  );
}
