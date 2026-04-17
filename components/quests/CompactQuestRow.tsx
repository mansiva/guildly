'use client';

import { useState } from 'react';
import { Quest } from '@/types';
import { Plus, ChevronDown, ChevronUp, Pencil } from 'lucide-react';
import LogProgressModal, { CompletionData } from './LogProgressModal';
import QuestCompleteOverlay from './QuestCompleteOverlay';
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

function timeLeft(deadline: Date): { label: string; urgent: boolean } {
  const msLeft = deadline.getTime() - Date.now();
  if (msLeft <= 0) return { label: 'Overdue', urgent: true };
  const mins = Math.ceil(msLeft / 60_000);
  if (mins < 60) return { label: `${mins}m left`, urgent: true };
  const hours = Math.ceil(msLeft / 3_600_000);
  if (hours < 24) return { label: `${hours}h left`, urgent: true };
  const days = Math.ceil(msLeft / 86_400_000);
  return { label: `${days}d left`, urgent: days <= 1 };
}

const DIFFICULTY_DOT: Record<string, string> = {
  easy:   'bg-green-400',
  medium: 'bg-amber-400',
  hard:   'bg-red-400',
};

export interface QuestMember {
  uid: string;
  displayName: string;
  photoURL?: string;
  xp?: number;
}

interface Props {
  quest: Quest;
  userId: string;
  groupId: string;
  /** Pass only when caller is admin/owner — its presence controls edit visibility */
  onEdit?: (q: Quest) => void;
  /** Optional group emoji shown when listing quests across multiple groups */
  groupLabel?: string;
  /** Member profiles for the expanded contributor list */
  members?: QuestMember[];
}

export default function CompactQuestRow({ quest, userId, groupId, onEdit, groupLabel, members = [] }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [completionData, setCompletionData] = useState<CompletionData | null>(null);

  function handleComplete(data: CompletionData) {
    // Enrich with display names from members prop
    const enriched = {
      ...data,
      contributions: data.contributions.map(c => {
        const m = members.find(mb => mb.uid === c.uid);
        return { ...c, displayName: m?.displayName ?? 'Unknown', photoURL: m?.photoURL, xp: m?.xp ?? 0 };
      }),
    };
    setCompletionData(enriched as CompletionData & { contributions: typeof enriched.contributions });
  }

  const total = quest.targetValue || 1;
  const current = quest.currentValue || 0;
  const myContrib = quest.contributions?.[userId] || 0;

  const myPct   = Math.min(100, Math.round((myContrib / total) * 100));
  const otherPct = Math.min(100 - myPct, Math.round(((current - myContrib) / total) * 100));
  const totalPct = Math.min(100, Math.round((current / total) * 100));

  const deadlineDate = toDate(quest.deadline);
  const completed = quest.status === 'completed';
  const overdue = !!deadlineDate && deadlineDate.getTime() < Date.now();
  const tl = !completed && deadlineDate ? timeLeft(deadlineDate) : null;
  const urgent = tl?.urgent ?? false;
  const canLog = !completed && !overdue;

  const diffDot = quest.difficulty ? DIFFICULTY_DOT[quest.difficulty] : null;

  return (
    <>
      <div className={`bg-white rounded-2xl border overflow-hidden ${completed ? 'border-green-200' : urgent ? 'border-orange-200' : 'border-gray-100'}`}>
        <button className="w-full flex items-center gap-2 px-4 py-3 text-left" onClick={() => setExpanded(v => !v)}>

          {/* Expand arrow */}
          {expanded
            ? <ChevronUp   size={15} className="text-gray-400 shrink-0" />
            : <ChevronDown size={15} className="text-gray-400 shrink-0" />
          }

          {/* Difficulty dot */}
          {diffDot && (
            <span className={`w-2 h-2 rounded-full shrink-0 ${diffDot}`} />
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-sm font-semibold text-gray-900 truncate">{quest.title}</span>
              {completed && <span className="text-xs text-green-600 font-medium shrink-0">✓ Done</span>}
              {tl?.label === 'Overdue' && <span className="text-xs text-red-500 font-medium shrink-0">⚠ Overdue</span>}
              {groupLabel && <span className="text-xs text-gray-400 shrink-0">{groupLabel}</span>}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden flex">
                <div className="h-full bg-green-400 transition-all" style={{ width: `${myPct}%` }} />
                <div className="h-full bg-indigo-400 transition-all" style={{ width: `${otherPct}%` }} />
              </div>
              <span className="text-xs text-gray-400 shrink-0">{totalPct}%</span>
              {tl && (
                <span className={`text-xs shrink-0 ${urgent ? 'text-orange-500 font-semibold' : 'text-gray-400'}`}>
                  {tl.label}
                </span>
              )}
            </div>
          </div>

          {canLog && (
            <button
              onClick={e => { e.stopPropagation(); setShowLog(true); }}
              className="w-8 h-8 bg-indigo-600 text-white rounded-xl flex items-center justify-center active:scale-95 transition-transform shrink-0"
            >
              <Plus size={16} />
            </button>
          )}
        </button>

        {expanded && (
          <div className="px-4 pb-3 border-t border-gray-50">
            {/* Description + meta row */}
            <div className="flex items-center gap-2 mt-2 mb-3">
              <div className="flex-1 min-w-0">
                {quest.description && (
                  <p className="text-xs text-gray-400 truncate">{quest.description}</p>
                )}
                <div className="flex items-center gap-2 mt-0.5">
                  {quest.difficulty && (
                    <span className="text-xs text-gray-400">{DIFFICULTY_LABELS[quest.difficulty]}</span>
                  )}
                  <span className="text-xs text-indigo-600 font-bold">+{quest.xpReward} XP</span>
                </div>
              </div>
              {onEdit && (
                <button
                  onClick={() => onEdit(quest)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 active:scale-95 transition-all shrink-0"
                >
                  <Pencil size={14} />
                </button>
              )}
            </div>

            {/* Contributor leaderboard */}
            {(() => {
              // Build sorted list of everyone who contributed
              const contribs = Object.entries(quest.contributions || {})
                .map(([uid, amount]) => {
                  const member = members.find(m => m.uid === uid);
                  const isMe = uid === userId;
                  const pct = Math.min(100, Math.round(((amount as number) / total) * 100));
                  return { uid, amount: amount as number, pct, isMe, displayName: member?.displayName || (isMe ? 'You' : 'Unknown') };
                })
                .filter(c => c.amount > 0)
                .sort((a, b) => b.amount - a.amount);

              if (contribs.length === 0) return (
                <p className="text-xs text-gray-400 text-center py-1">No contributions yet — be first!</p>
              );

              return (
                <div className="space-y-2">
                  {contribs.map((c, i) => (
                    <div key={c.uid} className="flex items-center gap-2">
                      {/* Rank */}
                      <span className="text-xs font-bold text-gray-300 w-4 shrink-0 text-center">
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                      </span>
                      {/* Name */}
                      <span className={`text-xs font-medium truncate flex-1 ${c.isMe ? 'text-indigo-600' : 'text-gray-700'}`}>
                        {c.isMe ? 'You' : c.displayName}
                      </span>
                      {/* Mini bar */}
                      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden shrink-0">
                        <div
                          className={`h-full rounded-full transition-all ${c.isMe ? 'bg-green-400' : 'bg-indigo-300'}`}
                          style={{ width: `${c.pct}%` }}
                        />
                      </div>
                      {/* Amount */}
                      <span className="text-xs text-gray-400 shrink-0 w-16 text-right">
                        {c.amount} {quest.unit} · {c.pct}%
                      </span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {showLog && canLog && (
        <LogProgressModal
          quest={quest}
          userId={userId}
          groupId={groupId}
          onClose={() => setShowLog(false)}
          onComplete={handleComplete}
        />
      )}

      {completionData && (
        <QuestCompleteOverlay
          questTitle={completionData.questTitle}
          unit={completionData.unit}
          targetValue={completionData.targetValue}
          totalXp={completionData.totalXp}
          contributions={(completionData as any).contributions}
          onDismiss={() => setCompletionData(null)}
        />
      )}
    </>
  );
}
