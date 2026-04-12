'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { doc, addDoc, updateDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import AppShell from '@/components/layout/AppShell';
import { useUserGroups, useGroupQuests } from '@/hooks/useGroup';
import QuestCard from '@/components/quests/QuestCard';
import QuestFormSheet, { questFormToFirestore } from '@/components/quests/QuestFormSheet';
import { Group, Quest } from '@/types';
import { Plus } from 'lucide-react';

export default function QuestsPage() {
  const { user } = useAuth();
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingQuest, setEditingQuest] = useState<Quest | null>(null);

  const { groups } = useUserGroups(user?.uid || null);
  const { quests } = useGroupQuests(activeGroupId);

  useEffect(() => {
    if (groups.length > 0 && !activeGroupId) setActiveGroupId(groups[0].id);
  }, [groups]);

  function openCreate() { setEditingQuest(null); setShowForm(true); }
  function openEdit(quest: Quest) { setEditingQuest(quest); setShowForm(true); }

  async function handleSave(data: ReturnType<typeof questFormToFirestore>) {
    if (!activeGroupId) return;
    if (editingQuest) {
      await updateDoc(doc(db, 'groups', activeGroupId, 'quests', editingQuest.id), {
        title: data.title, description: data.description,
        targetValue: data.targetValue, unit: data.unit,
        difficulty: data.difficulty, duration: data.duration,
        deadline: data.deadline, xpReward: data.xpReward,
      });
    } else {
      await addDoc(collection(db, 'groups', activeGroupId, 'quests'), {
        groupId: activeGroupId,
        title: data.title, description: data.description,
        category: 'custom',
        targetValue: data.targetValue, unit: data.unit,
        difficulty: data.difficulty, duration: data.duration,
        currentValue: 0, contributions: {}, xpDeferred: {},
        status: 'active', xpReward: data.xpReward,
        deadline: data.deadline,
        createdAt: serverTimestamp(),
        createdBy: user!.uid,
      });
    }
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
              <QuestCard key={q.id} quest={q} userId={user!.uid} groupId={activeGroupId!} onEdit={openEdit} />
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      {activeGroupId && (
        <button onClick={openCreate}
          className="fixed z-40 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 90px)', right: '16px' }}>
          <Plus size={26} />
        </button>
      )}

      {showForm && (
        <QuestFormSheet
          editing={editingQuest}
          onClose={() => setShowForm(false)}
          onSave={handleSave}
        />
      )}
    </AppShell>
  );
}
