'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { doc, getDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import AppShell from '@/components/layout/AppShell';
import { useGroupQuests } from '@/hooks/useGroup';
import QuestCard from '@/components/quests/QuestCard';
import { Group, QuestCategory } from '@/types';
import { QUEST_TEMPLATES, CATEGORY_LABELS, CATEGORY_COLORS } from '@/lib/quest-templates';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const CATEGORIES: QuestCategory[] = ['exercise', 'learning', 'art', 'music', 'wellness', 'social', 'custom'];

export default function QuestsPage() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<QuestCategory | 'all'>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [category, setCategory] = useState<QuestCategory>('exercise');
  const [target, setTarget] = useState('');
  const [unit, setUnit] = useState('');
  const [days, setDays] = useState('7');
  const [xpReward, setXpReward] = useState('100');

  const { quests } = useGroupQuests(activeGroupId);

  const filtered = activeCategory === 'all' ? quests : quests.filter(q => q.category === activeCategory);

  useEffect(() => {
    if (!user) return;
    async function load() {
      const snap = await getDoc(doc(db, 'users', user!.uid));
      if (!snap.exists()) return;
      const gIds: string[] = snap.data().groupIds || [];
      const loaded = await Promise.all(gIds.map(async id => {
        const gs = await getDoc(doc(db, 'groups', id));
        return gs.exists() ? { id: gs.id, ...gs.data() } as Group : null;
      }));
      const valid = loaded.filter(Boolean) as Group[];
      setGroups(valid);
      setActiveGroupId(valid[0]?.id || null);
    }
    load();
  }, [user]);

  function applyTemplate(templateId: string) {
    const t = QUEST_TEMPLATES.find(t => t.id === templateId);
    if (!t) return;
    setTitle(t.title);
    setDesc(t.description);
    setCategory(t.category);
    setTarget(String(t.suggestedTarget));
    setUnit(t.unit);
    setXpReward(String(t.xpReward));
    setSelectedTemplate(templateId);
  }

  async function createQuest() {
    if (!user || !activeGroupId || !title.trim() || !target || !unit.trim()) return;
    setLoading(true); setError('');
    try {
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + parseInt(days));
      await addDoc(collection(db, 'groups', activeGroupId, 'quests'), {
        title: title.trim(),
        description: desc.trim(),
        category,
        targetValue: parseFloat(target),
        unit: unit.trim(),
        currentValue: 0,
        contributions: {},
        deadline,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        status: 'active',
        xpReward: parseInt(xpReward),
        groupId: activeGroupId,
      });
      setShowCreate(false);
      setTitle(''); setDesc(''); setTarget(''); setUnit(''); setSelectedTemplate(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create');
    } finally { setLoading(false); }
  }

  return (
    <AppShell>
      <div className="px-4 pt-6">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-2xl font-bold text-gray-900">Quests</h1>
          {activeGroupId && (
            <button onClick={() => setShowCreate(!showCreate)}
              className="p-2 bg-indigo-600 text-white rounded-2xl">
              <Plus size={20} />
            </button>
          )}
        </div>

        {/* Group selector */}
        {groups.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
            {groups.map(g => (
              <button key={g.id} onClick={() => setActiveGroupId(g.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  activeGroupId === g.id ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200'
                }`}>
                {g.emoji} {g.name}
              </button>
            ))}
          </div>
        )}

        {/* Create quest panel */}
        {showCreate && activeGroupId && (
          <div className="bg-white rounded-3xl p-5 mb-4 border border-indigo-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold">New Quest</h3>
              <button onClick={() => setShowCreate(false)}><X size={18} /></button>
            </div>

            {/* Templates */}
            <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Quick Templates</p>
            <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
              {QUEST_TEMPLATES.map(t => (
                <button key={t.id} onClick={() => applyTemplate(t.id)}
                  className={cn(
                    'shrink-0 flex flex-col items-center gap-1 p-3 rounded-2xl border text-xs transition-all',
                    selectedTemplate === t.id ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-gray-50'
                  )}>
                  <span className="text-xl">{t.emoji}</span>
                  <span className="w-16 text-center leading-tight">{t.title}</span>
                </button>
              ))}
            </div>

            <div className="space-y-3">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {CATEGORIES.map(c => (
                  <button key={c} onClick={() => setCategory(c)}
                    className={cn('shrink-0 px-3 py-1 rounded-full text-xs font-semibold', category === c ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600')}>
                    {CATEGORY_LABELS[c]}
                  </button>
                ))}
              </div>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Quest title" maxLength={60}
                className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-200" />
              <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description" maxLength={120}
                className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-200" />
              <div className="flex gap-2">
                <input value={target} onChange={e => setTarget(e.target.value)} placeholder="Target" type="number" min="1"
                  className="flex-1 px-4 py-3 bg-gray-50 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-200" />
                <input value={unit} onChange={e => setUnit(e.target.value)} placeholder="Unit (steps, km...)"
                  className="flex-1 px-4 py-3 bg-gray-50 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-200" />
              </div>
              <div className="flex gap-2">
                <select value={days} onChange={e => setDays(e.target.value)}
                  className="flex-1 px-4 py-3 bg-gray-50 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-200">
                  <option value="3">3 days</option>
                  <option value="7">1 week</option>
                  <option value="14">2 weeks</option>
                  <option value="30">1 month</option>
                </select>
                <input value={xpReward} onChange={e => setXpReward(e.target.value)} placeholder="XP reward" type="number"
                  className="flex-1 px-4 py-3 bg-gray-50 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-200" />
              </div>
            </div>

            {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
            <button onClick={createQuest} disabled={loading || !title.trim() || !target || !unit.trim()}
              className="w-full mt-4 py-3 bg-indigo-600 text-white font-semibold rounded-2xl text-sm disabled:opacity-50 active:scale-95 transition-transform">
              {loading ? 'Creating...' : '⚡ Launch Quest'}
            </button>
          </div>
        )}

        {/* Category filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
          <button onClick={() => setActiveCategory('all')}
            className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium ${activeCategory === 'all' ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
            All
          </button>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setActiveCategory(c)}
              className={cn('shrink-0 px-3 py-1.5 rounded-full text-sm font-medium', activeCategory === c ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600')}>
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>

        {/* Quest list */}
        {groups.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🎯</div>
            <p className="text-gray-500">Join a group first to see quests</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400">No quests here — add one!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(q => <QuestCard key={q.id} quest={q} userId={user!.uid} groupId={activeGroupId!} />)}
          </div>
        )}
      </div>
    </AppShell>
  );
}
