'use client';

import { useState } from 'react';
import { Quest } from '@/types';
import { Plus, ChevronDown, ChevronUp, Pencil } from 'lucide-react';
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

  const total = quest.targetValue || 1;
  const current = quest.currentValue || 0;
  const myContrib = quest.contributions?.[userId] || 0;

  // Percentages capped at 100
  const myPct = Math.min(100, Math.round((myContrib / total) * 100));
  const otherPct = Math.min(100 - myPct, Math.round(((current - myContrib) / total) * 100));

  const deadlineDate = toDate(quest.deadline);
  const daysLeft = deadlineDate
    ? Math.max(0, Math.ceil((deadlineDate.getTime() - Date.now()) / 86400000))
    : null;
  const completed = quest.status === 'completed';
  const urgent = !completed && daysLeft !== null && daysLeft <= 1;
  const totalPct = Math.min(100, Math.round((current / total) * 100));

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
              {/* Dual-colour progress bar (collapsed) */}
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden flex">
                <div className="h-full bg-green-400 transition-all" style={{ width: `${myPct}%` }} />
                <div className="h-full bg-indigo-400 transition-all" style={{ width: `${otherPct}%` }} />
              </div>
              <span className="text-xs text-gray-400 shrink-0">{totalPct}%</span>
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
            {/* Dual-colour bar with legend */}
            <div className="mt-3 mb-2">
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden flex mb-1.5">
                <div className="h-full bg-green-400 transition-all" style={{ width: `${myPct}%` }} />
                <div className="h-full bg-indigo-400 transition-all" style={{ width: `${otherPct}%` }} />
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-400" />
                  You {myPct}%
                </span>
                {otherPct > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-indigo-400" />
                    Others {otherPct}%
                  </span>
                )}
                <span className="ml-auto text-indigo-600 font-bold">+{quest.xpReward} XP</span>
              </div>
            </div>

            <div className="flex items-center justify-between mt-1">
              {quest.difficulty && (
                <span className="text-xs text-gray-400">{DIFFICULTY_LABELS[quest.difficulty]}</span>
              )}
              {quest.description && (
                <p className="text-xs text-gray-500 flex-1 mx-2 truncate">{quest.description}</p>
              )}
              {/* Edit icon — always shown */}
              {onEdit && (
                <button
                  onClick={() => onEdit(quest)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 active:scale-95 transition-all"
                >
                  <Pencil size={14} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {showLog && (
        <LogProgressModal quest={quest} userId={userId} groupId={groupId} onClose={() => setShowLog(false)} />
      )}
    </>
  );
}
