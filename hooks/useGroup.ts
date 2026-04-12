'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot, collection, query, orderBy, where, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Group, Quest, ActivityEntry, GroupMember } from '@/types';

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

export function useGroupMembers(groupId: string | null) {
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId) { setLoading(false); return; }
    const q = query(
      collection(db, 'groupMembers'),
      where('groupId', '==', groupId)
    );
    const unsub = onSnapshot(q, (snap) => {
      setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() } as GroupMember)));
      setLoading(false);
    });
    return unsub;
  }, [groupId]);

  return { members, loading };
}

export function useUserGroups(userId: string | null) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    const q = query(
      collection(db, 'groupMembers'),
      where('userId', '==', userId)
    );
    const unsub = onSnapshot(q, async (snap) => {
      const groupIds = snap.docs.map(d => d.data().groupId as string);
      const loaded = await Promise.all(groupIds.map(async id => {
        const gs = await getDoc(doc(db, 'groups', id));
        return gs.exists() ? { id: gs.id, ...gs.data() } as Group : null;
      }));
      setGroups(loaded.filter(Boolean) as Group[]);
      setLoading(false);
    });
    return unsub;
  }, [userId]);

  return { groups, loading };
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

/** Fetches member count + active quest count for a list of group IDs */
export function useGroupStats(groupIds: string[]) {
  const [stats, setStats] = useState<Record<string, { memberCount: number; activeQuestCount: number }>>({});

  useEffect(() => {
    if (groupIds.length === 0) return;
    const key = groupIds.join(',');
    Promise.all(groupIds.map(async id => {
      const [membersSnap, questsSnap] = await Promise.all([
        import('firebase/firestore').then(({ getDocs, query, collection, where }) =>
          getDocs(query(collection(db, 'groupMembers'), where('groupId', '==', id)))
        ),
        import('firebase/firestore').then(({ getDocs, query, collection, where }) =>
          getDocs(query(collection(db, 'groups', id, 'quests'), where('status', '==', 'active')))
        ),
      ]);
      return { id, memberCount: membersSnap.size, activeQuestCount: questsSnap.size };
    })).then(results => {
      const map: Record<string, { memberCount: number; activeQuestCount: number }> = {};
      results.forEach(r => { map[r.id] = { memberCount: r.memberCount, activeQuestCount: r.activeQuestCount }; });
      setStats(map);
    });
  }, [groupIds.join(',')]);  // eslint-disable-line react-hooks/exhaustive-deps

  return stats;
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
