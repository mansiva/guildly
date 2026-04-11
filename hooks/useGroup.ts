'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot, collection, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Group, Quest, ActivityEntry } from '@/types';

export function useGroup(groupId: string | null) {
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId) { setLoading(false); return; }
    const unsub = onSnapshot(doc(db, 'groups', groupId), (snap) => {
      if (snap.exists()) {
        setGroup({ id: snap.id, ...snap.data() } as Group);
      }
      setLoading(false);
    });
    return unsub;
  }, [groupId]);

  return { group, loading };
}

export function useGroupQuests(groupId: string | null) {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId) { setLoading(false); return; }
    const q = query(
      collection(db, 'groups', groupId, 'quests'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setQuests(snap.docs.map(d => ({ id: d.id, ...d.data() } as Quest)));
      setLoading(false);
    });
    return unsub;
  }, [groupId]);

  return { quests, loading };
}

export function useGroupFeed(groupId: string | null) {
  const [feed, setFeed] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId) { setLoading(false); return; }
    const q = query(
      collection(db, 'groups', groupId, 'feed'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setFeed(snap.docs.map(d => ({ id: d.id, ...d.data() } as ActivityEntry)));
      setLoading(false);
    });
    return unsub;
  }, [groupId]);

  return { feed, loading };
}
