'use client';

import { useState } from 'react';
import { Quest } from '@/types';
import { X } from 'lucide-react';

interface Props {
  quest: Quest;
  userId: string;
  groupId: string;
  onClose: () => void;
}

export default function LogProgressModal({ quest, userId, groupId, onClose }: Props) {
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) { setError('Enter a valid number'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/quests/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questId: quest.id, groupId, userId, value: num }),
      });
      if (!res.ok) throw new Error(await res.text());
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to log');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg text-gray-900">Log Progress</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-1">{quest.title}</p>
        <p className="text-xs text-gray-400 mb-4">
          Current: {quest.currentValue} / {quest.targetValue} {quest.unit}
        </p>
        <form onSubmit={handleSubmit}>
          <div className="flex items-center gap-3 mb-4">
            <input
              type="number"
              min="0.1"
              step="any"
              placeholder="0"
              value={value}
              onChange={e => setValue(e.target.value)}
              className="flex-1 px-4 py-3 bg-gray-50 rounded-2xl text-center text-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-300"
              autoFocus
            />
            <span className="text-gray-500 font-medium">{quest.unit}</span>
          </div>
          {error && <p className="text-red-500 text-xs text-center mb-3">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-2xl disabled:opacity-50 active:scale-95 transition-transform"
          >
            {loading ? 'Saving...' : 'Add to Quest ⚡'}
          </button>
        </form>
      </div>
    </div>
  );
}
