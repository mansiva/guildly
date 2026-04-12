'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Quest } from '@/types';
import { QuestDifficulty, QuestDuration, computeQuestXp, deadlineForDuration, DIFFICULTY_LABELS } from '@/lib/questXp';
import { Timestamp } from 'firebase/firestore';

const UNIT_OPTIONS = ['sessions', 'km', 'miles', 'pages', 'minutes', 'hours', 'reps', 'items', 'days'];

export interface QuestFormData {
  title: string;
  description: string;
  targetValue: string;
  unit: string;
  customUnit: string;
  difficulty: QuestDifficulty;
  duration: QuestDuration;
  customDeadline: string;
}

export const EMPTY_QUEST_FORM: QuestFormData = {
  title: '',
  description: '',
  targetValue: '',
  unit: 'sessions',
  customUnit: '',
  difficulty: 'medium',
  duration: 'weekly',
  customDeadline: '',
};

export function questFormToFirestore(form: QuestFormData): {
  title: string; description: string; targetValue: number; unit: string;
  difficulty: QuestDifficulty; duration: QuestDuration;
  deadline: Timestamp | null; xpReward: number;
} {
  const unit = form.unit === 'custom' ? form.customUnit.trim() || 'items' : form.unit;
  let deadline: Date;
  if (form.duration === 'custom') {
    deadline = form.customDeadline ? new Date(form.customDeadline) : new Date(Date.now() + 7 * 86400000);
  } else {
    deadline = deadlineForDuration(form.duration);
  }
  const xpReward = computeQuestXp(form.difficulty, deadline);
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    targetValue: Number(form.targetValue),
    unit,
    difficulty: form.difficulty,
    duration: form.duration,
    deadline: Timestamp.fromDate(deadline),
    xpReward,
  };
}

export function questToFormData(quest: Quest): QuestFormData {
  const unit = UNIT_OPTIONS.includes(quest.unit) ? quest.unit : 'custom';
  const customUnit = UNIT_OPTIONS.includes(quest.unit) ? '' : quest.unit;
  let customDeadline = '';
  const duration: QuestDuration = (quest.duration as QuestDuration) || 'custom';
  if (duration === 'custom' && quest.deadline) {
    const d = typeof quest.deadline === 'object' && 'toDate' in quest.deadline
      ? (quest.deadline as unknown as { toDate: () => Date }).toDate()
      : new Date(quest.deadline as unknown as string);
    if (!isNaN(d.getTime())) customDeadline = d.toISOString().split('T')[0];
  }
  return {
    title: quest.title,
    description: quest.description || '',
    targetValue: String(quest.targetValue),
    unit, customUnit,
    difficulty: (quest.difficulty as QuestDifficulty) || 'medium',
    duration,
    customDeadline,
  };
}

interface Props {
  editing: Quest | null;
  onClose: () => void;
  onSave: (data: ReturnType<typeof questFormToFirestore>) => Promise<void>;
}

const DURATION_LABELS: Record<QuestDuration, string> = {
  daily: '📅 Daily',
  weekly: '📆 Weekly',
  monthly: '🗓 Monthly',
  custom: '📌 Custom date',
};

const DIFFICULTY_COLORS: Record<QuestDifficulty, string> = {
  easy: 'bg-green-500',
  medium: 'bg-yellow-500',
  hard: 'bg-red-500',
};

export default function QuestFormSheet({ editing, onClose, onSave }: Props) {
  const [form, setForm] = useState<QuestFormData>(editing ? questToFormData(editing) : EMPTY_QUEST_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setForm(editing ? questToFormData(editing) : EMPTY_QUEST_FORM);
    setError('');
  }, [editing]);

  // Compute preview XP
  let previewXp = 0;
  try {
    const deadline = form.duration === 'custom'
      ? (form.customDeadline ? new Date(form.customDeadline) : new Date(Date.now() + 7 * 86400000))
      : deadlineForDuration(form.duration);
    previewXp = computeQuestXp(form.difficulty, deadline);
  } catch { previewXp = 0; }

  async function handleSave() {
    if (!form.title.trim()) { setError('Quest name is required'); return; }
    if (!form.targetValue || Number(form.targetValue) <= 0) { setError('Set a goal amount'); return; }
    if (form.duration === 'custom' && !form.customDeadline) { setError('Pick a deadline'); return; }
    setSaving(true); setError('');
    try {
      await onSave(questFormToFirestore(form));
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save quest');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-[480px] bg-white rounded-t-3xl px-5 pt-5 pb-20 overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">
            {editing ? 'Edit Quest' : 'New Quest'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-full bg-gray-100">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="space-y-5">
          {/* Title */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Quest Name *</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Run 5km every day" maxLength={60}
              className="w-full px-4 py-3 bg-gray-50 text-gray-900 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-200" />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
              Description <span className="normal-case font-normal">(optional)</span>
            </label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="What needs to be done?" maxLength={200} rows={2}
              className="w-full px-4 py-3 bg-gray-50 text-gray-900 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-200 resize-none" />
          </div>

          {/* Goal */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Goal *</label>
            <div className="flex gap-2">
              <input type="number" value={form.targetValue} onChange={e => setForm(f => ({ ...f, targetValue: e.target.value }))}
                placeholder="30" min="1"
                className="w-28 px-4 py-3 bg-gray-50 text-gray-900 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-200" />
              <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                className="flex-1 px-4 py-3 bg-gray-50 text-gray-900 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-200">
                {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                <option value="custom">custom…</option>
              </select>
            </div>
            {form.unit === 'custom' && (
              <input value={form.customUnit} onChange={e => setForm(f => ({ ...f, customUnit: e.target.value }))}
                placeholder="e.g. chapters, workouts"
                className="w-full mt-2 px-4 py-3 bg-gray-50 text-gray-900 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-200" />
            )}
          </div>

          {/* Duration */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">Duration</label>
            <div className="grid grid-cols-2 gap-2">
              {(['daily', 'weekly', 'monthly', 'custom'] as QuestDuration[]).map(d => (
                <button key={d} onClick={() => setForm(f => ({ ...f, duration: d }))}
                  className={`py-2.5 px-3 rounded-xl text-sm font-medium border transition-all text-left ${
                    form.duration === d ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 text-gray-700 border-gray-200'
                  }`}>
                  {DURATION_LABELS[d]}
                </button>
              ))}
            </div>
            {form.duration === 'custom' && (
              <input type="date" value={form.customDeadline}
                min={new Date().toISOString().split('T')[0]}
                onChange={e => setForm(f => ({ ...f, customDeadline: e.target.value }))}
                className="w-full mt-2 px-4 py-3 bg-gray-50 text-gray-900 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-200" />
            )}
          </div>

          {/* Difficulty */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">Difficulty</label>
            <div className="flex gap-2">
              {(['easy', 'medium', 'hard'] as QuestDifficulty[]).map(d => (
                <button key={d} onClick={() => setForm(f => ({ ...f, difficulty: d }))}
                  className={`flex-1 py-3 rounded-xl text-sm font-semibold border transition-all ${
                    form.difficulty === d ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 text-gray-700 border-gray-200'
                  }`}>
                  {DIFFICULTY_LABELS[d]}
                </button>
              ))}
            </div>
          </div>

          {/* XP preview */}
          <div className={`flex items-center justify-between px-4 py-3 rounded-2xl ${DIFFICULTY_COLORS[form.difficulty]} bg-opacity-10`}>
            <span className="text-sm font-medium text-gray-700">Quest reward</span>
            <span className="text-lg font-bold text-indigo-600">⚡ {previewXp} XP</span>
          </div>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <button onClick={handleSave}
            disabled={saving || !form.title.trim() || !form.targetValue}
            className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl text-sm active:scale-95 transition-transform disabled:opacity-50">
            {saving ? 'Saving…' : editing ? 'Save Changes' : '⚡ Create Quest'}
          </button>
        </div>
      </div>
    </div>
  );
}
