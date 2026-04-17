'use client';

import { useState } from 'react';
import { Quest } from '@/types';
import { X } from 'lucide-react';

export interface CompletionData {
  questTitle: string;
  unit: string;
  targetValue: number;
  totalXp: number;
  contributions: {
    uid: string;
    contributed: number;
    pct: number;
    xpEarned: number;
    isTop: boolean;
    isMe: boolean;
  }[];
}

interface Props {
  quest: Quest;
  userId: string;
  groupId: string;
  onClose: () => void;
  onComplete?: (data: CompletionData) => void;
}

export default function LogProgressModal({ quest, userId, groupId, onClose, onComplete }: Props) {
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) { setError('Must be greater than 0'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/quests/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questId: quest.id, groupId, userId, value: num }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      if (data.completed && onComplete) {
        // Build contributions map from the quest + this new log
        const updatedContribs: Record<string, number> = {
          ...(quest.contributions ?? {}),
          [userId]: ((quest.contributions?.[userId] ?? 0) + num),
        };
        const target = quest.targetValue || 1;
        const questXp = quest.xpReward || 100;

        // Find top contributor
        let topUid = '';
        let topAmount = 0;
        for (const [uid, amount] of Object.entries(updatedContribs)) {
          if (amount > topAmount) { topAmount = amount; topUid = uid; }
        }

        const contribEntries = Object.entries(updatedContribs).map(([uid, contributed]) => {
          const pct = Math.round(Math.min(contributed / target, 1) * 100);
          const deferred = Math.floor(Math.min(contributed / target, 1) * questXp * 0.5);
          const bonus = uid === topUid ? Math.floor(questXp * 0.1) : 0;
          return {
            uid,
            contributed,
            pct,
            xpEarned: deferred + bonus,
            isTop: uid === topUid,
            isMe: uid === userId,
          };
        });

        onClose();
        onComplete({
          questTitle: quest.title,
          unit: quest.unit,
          targetValue: target,
          totalXp: questXp,
          contributions: contribEntries,
        });
      } else {
        onClose();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to log');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-end bg-black/50">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full max-w-[480px] bg-white rounded-t-3xl px-5 pt-5 pb-16">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg text-gray-900">Log Progress</h2>
          <button onClick={onClose} className="p-2 rounded-full bg-gray-100">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <p className="text-sm text-gray-700 font-semibold mb-0.5">{quest.title}</p>
        <p className="text-xs text-gray-400 mb-5">
          Progress: {quest.currentValue} / {quest.targetValue} {quest.unit}
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <input
              type="number"
              min="0.01"
              step="any"
              placeholder="0"
              value={value}
              onChange={e => setValue(e.target.value)}
              className="w-full px-3 py-4 bg-gray-50 rounded-2xl text-center text-3xl font-bold outline-none focus:ring-2 focus:ring-indigo-300 text-gray-900"
              autoFocus
            />
          </div>
          {error && <p className="text-red-500 text-xs text-center mb-3">{error}</p>}
          <button
            type="submit"
            disabled={loading || !value || parseFloat(value) <= 0}
            className="w-full py-4 bg-indigo-600 text-white font-semibold rounded-2xl disabled:opacity-50 active:scale-95 transition-transform text-base"
          >
            {loading ? 'Saving...' : 'Add to Quest ⚡'}
          </button>
        </form>
      </div>
    </div>
  );
}
