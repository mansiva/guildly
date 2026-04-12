'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { doc, getDoc, addDoc, updateDoc, collection, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import AppShell from '@/components/layout/AppShell';
import { useUserGroups, useGroupQuests } from '@/hooks/useGroup';
import QuestCard from '@/components/quests/QuestCard';
import { Group, Quest, QuestCategory } from '@/types';
import { X, Plus } from 'lucide-react';

const UNIT_OPTIONS = ['sessions', 'km', 'miles', 'pages', 'minutes', 'hours', 'reps', 'items', 'days'];
const XP_OPTIONS = [50, 100, 250, 500];

interface QuestForm {
  title: string;
  description: string;
  targetValue: string;
  unit: string;
  customUnit: string;
  xpReward: number | 'custom';
  customXp: string;
  deadline: string;
}

const EMPTY_FORM: QuestForm = {
  title: '',
  description: '',
  targetValue: '',
  unit: 'sessions',
  customUnit: '',
  xpReward: 100,
  customXp: '',
  deadline: '',
};

export default function QuestsPage() {
  const { user } = useAuth();
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingQuest, setEditingQuest] = useState<Quest | null>(null);
  const [form, setForm] = useState<QuestForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { groups } = useUserGroups(user?.uid || null);
  const { quests } = useGroupQuests(activeGroupId);

  useEffect(() => {
    if (groups.length > 0 && !activeGroupId) {
      setActiveGroupId(groups[0].id);
    }
  }, [groups]);

  function openCreate() {
    setEditingQuest(null);
    setForm(EMPTY_FORM);
    setError('');
    setShowForm(true);
  }

  function openEdit(quest: Quest) {
    setEditingQuest(quest);
    // Convert deadline back to string for the date input
    let deadlineStr = '';
    if (quest.deadline) {
      const d = typeof quest.deadline === 'object' && 'toDate' in quest.deadline
        ? (quest.deadline as unknown as { toDate: () => Date }).toDate()
        : new Date(quest.deadline as unknown as string);
      if (!isNaN(d.getTime())) {
        deadlineStr = d.toISOString().split('T')[0];
      }
    }
    setForm({
      title: quest.title,
      description: quest.description || '',
      targetValue: String(quest.targetValue),
      unit: UNIT_OPTIONS.includes(quest.unit) ? quest.unit : 'custom',
      customUnit: UNIT_OPTIONS.includes(quest.unit) ? '' : quest.unit,
      xpReward: XP_OPTIONS.includes(quest.xpReward) ? quest.xpReward : 'custom',
      customXp: XP_OPTIONS.includes(quest.xpReward) ? '' : String(quest.xpReward),
      deadline: deadlineStr,
    });
    setError('');
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.title.trim()) { setError('Quest name is required'); return; }
    if (!form.targetValue || Number(form.targetValue) <= 0) { setError('Set a goal amount'); return; }
    if (!activeGroupId) return;
    setSaving(true); setError('');
    try {
      const unit = form.unit === 'custom' ? form.customUnit.trim() || 'items' : form.unit;
      const xpReward = form.xpReward === 'custom' ? Number(form.customXp) || 100 : form.xpReward;
      const deadline = form.deadline ? Timestamp.fromDate(new Date(form.deadline)) : null;

      if (editingQuest) {
        await updateDoc(doc(db, 'groups', activeGroupId, 'quests', editingQuest.id), {
          title: form.title.trim(),
          description: form.description.trim(),
          targetValue: Number(form.targetValue),
          unit,
          xpReward,
          deadline,
        });
      } else {
        await addDoc(collection(db, 'groups', activeGroupId, 'quests'), {
          groupId: activeGroupId,
          title: form.title.trim(),
          description: form.description.trim(),
          category: 'custom' as QuestCategory,
          targetValue: Number(form.targetValue),
          unit,
          currentValue: 0,
          contributions: {},
          status: 'active',
          xpReward,
          deadline,
          createdAt: serverTimestamp(),
          createdBy: user!.uid,
        });
      }
      setShowForm(false);
      setEditingQuest(null);
      setForm(EMPTY_FORM);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save quest');
    } finally { setSaving(false); }
  }

  return (
    <AppShell>
      <div className="px-4 pt-6 pb-24">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-2xl font-bold text-gray-900">Quests</h1>
        </div>

        {/* Group selector */}
        {groups.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
            {groups.map((g: Group) => (
              <button key={g.id} onClick={() => setActiveGroupId(g.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  activeGroupId === g.id ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200'
                }`}>
                {g.emoji} {g.name}
              </button>
            ))}
          </div>
        )}

        {/* Quest list */}
        {groups.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🎯</div>
            <p className="text-gray-500">Join a group first to see quests</p>
          </div>
        ) : quests.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">⚡</div>
            <p className="text-gray-500 mb-2">No quests yet</p>
            <p className="text-gray-400 text-sm">Tap the + button to add the first one</p>
          </div>
        ) : (
          <div className="space-y-3">
            {quests.map(q => (
              <QuestCard
                key={q.id}
                quest={q}
                userId={user!.uid}
                groupId={activeGroupId!}
                onEdit={openEdit}
              />
            ))}
          </div>
        )}
      </div>

      {/* FAB — positioned above bottom nav */}
      {activeGroupId && (
        <button
          onClick={openCreate}
          className="fixed z-40 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform"
          style={{
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 90px)',
            right: '16px',
          }}
        >
          <Plus size={26} />
        </button>
      )}

      {/* Quest form bottom sheet */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowForm(false)} />
          <div className="relative w-full max-w-[480px] bg-white rounded-t-3xl px-5 pt-5 pb-16 overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">
                {editingQuest ? 'Edit Quest' : 'New Quest'}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-full bg-gray-100">
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Quest Name *</label>
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Run 5km every day"
                  maxLength={60}
                  className="w-full px-4 py-3 bg-gray-50 text-gray-900 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                  Description <span className="normal-case font-normal">(optional)</span>
                </label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="What needs to be done?"
                  maxLength={200}
                  rows={2}
                  className="w-full px-4 py-3 bg-gray-50 text-gray-900 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-200 resize-none"
                />
              </div>

              {/* Goal */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Goal *</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={form.targetValue}
                    onChange={e => setForm(f => ({ ...f, targetValue: e.target.value }))}
                    placeholder="30"
                    min="1"
                    className="w-28 px-4 py-3 bg-gray-50 text-gray-900 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                  <select
                    value={form.unit}
                    onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                    className="flex-1 px-4 py-3 bg-gray-50 text-gray-900 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-200"
                  >
                    {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                    <option value="custom">custom...</option>
                  </select>
                </div>
                {form.unit === 'custom' && (
                  <input
                    value={form.customUnit}
                    onChange={e => setForm(f => ({ ...f, customUnit: e.target.value }))}
                    placeholder="e.g. chapters, workouts"
                    className="w-full mt-2 px-4 py-3 bg-gray-50 text-gray-900 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                )}
              </div>

              {/* XP Reward */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">XP Reward</label>
                <div className="flex gap-2 flex-wrap">
                  {XP_OPTIONS.map(xp => (
                    <button key={xp}
                      onClick={() => setForm(f => ({ ...f, xpReward: xp }))}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${form.xpReward === xp ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                      {xp} XP
                    </button>
                  ))}
                  <button
                    onClick={() => setForm(f => ({ ...f, xpReward: 'custom' }))}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${form.xpReward === 'custom' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                    Custom
                  </button>
                </div>
                {form.xpReward === 'custom' && (
                  <input
                    type="number"
                    value={form.customXp}
                    onChange={e => setForm(f => ({ ...f, customXp: e.target.value }))}
                    placeholder="e.g. 750"
                    min="1"
                    className="w-full mt-2 px-4 py-3 bg-gray-50 text-gray-900 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                )}
              </div>

              {/* Deadline */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                  Deadline <span className="normal-case font-normal">(optional)</span>
                </label>
                <input
                  type="date"
                  value={form.deadline}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-50 text-gray-900 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>

              {error && <p className="text-red-500 text-sm text-center">{error}</p>}

              <button
                onClick={handleSave}
                disabled={saving || !form.title.trim() || !form.targetValue}
                className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl text-sm active:scale-95 transition-transform disabled:opacity-50 mt-2"
              >
                {saving ? 'Saving...' : editingQuest ? 'Save Changes' : '⚡ Create Quest'}
              </button>

            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
