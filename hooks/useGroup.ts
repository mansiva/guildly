'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot, collection, query, orderBy, where, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Group, Quest, ActivityEntry, GroupMember } from '@/types';

function readCache<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}

function writeCache<T>(key: string, value: T) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota — ignore */ }
}

export function useGroup(groupId: string | null) {
  const cacheKey = groupId ? `guildly_group_${groupId}` : null;
  const [group, setGroup] = useState<Group | null>(() => cacheKey ? readCache<Group | null>(cacheKey, null) : null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId || !cacheKey) { setLoading(false); return; }
    const unsub = onSnapshot(doc(db, 'groups', groupId), (snap) => {
      if (snap.exists()) {
        const fresh = { id: snap.id, ...snap.data() } as Group;
        setGroup(fresh);
        writeCache(cacheKey, fresh);
      }
      setLoading(false);
    });
    return unsub;
  }, [groupId]);  // eslint-disable-line react-hooks/exhaustive-deps

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
  const cacheKey = userId ? `guildly_groups_${userId}` : null;
  const [groups, setGroups] = useState<Group[]>(() => cacheKey ? readCache<Group[]>(cacheKey, []) : []);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !cacheKey) { setLoading(false); return; }
    const q = query(collection(db, 'groupMembers'), where('userId', '==', userId));
    const unsub = onSnapshot(q, async (snap) => {
      const groupIds = snap.docs.map(d => d.data().groupId as string);
      const loaded = await Promise.all(groupIds.map(async id => {
        const gs = await getDoc(doc(db, 'groups', id));
        return gs.exists() ? { id: gs.id, ...gs.data() } as Group : null;
      }));
      const valid = loaded.filter(Boolean) as Group[];
      setGroups(valid);
      writeCache(cacheKey, valid);
      setLoading(false);
    });
    return unsub;
  }, [userId]);  // eslint-disable-line react-hooks/exhaustive-deps

  return { groups, loading };
}

export function useGroupQuests(groupId: string | null) {
  const cacheKey = groupId ? `guildly_quests_${groupId}` : null;
  const [quests, setQuests] = useState<Quest[]>(() => cacheKey ? readCache<Quest[]>(cacheKey, []) : []);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId || !cacheKey) { setLoading(false); return; }
    const q = query(collection(db, 'groups', groupId, 'quests'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const fresh = snap.docs.map(d => ({ id: d.id, ...d.data() } as Quest));
      setQuests(fresh);
      writeCache(cacheKey, fresh);
      setLoading(false);
    });
    return unsub;
  }, [groupId]);  // eslint-disable-line react-hooks/exhaustive-deps

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
  const cacheKey = groupId ? `guildly_feed_${groupId}` : null;
  const [feed, setFeed] = useState<ActivityEntry[]>(() => cacheKey ? readCache<ActivityEntry[]>(cacheKey, []) : []);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId || !cacheKey) { setLoading(false); return; }
    const q = query(collection(db, 'groups', groupId, 'feed'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const fresh = snap.docs.map(d => ({ id: d.id, ...d.data() } as ActivityEntry));
      setFeed(fresh);
      writeCache(cacheKey, fresh);
      setLoading(false);
    });
    return unsub;
  }, [groupId]);  // eslint-disable-line react-hooks/exhaustive-deps

  return { feed, loading };
}
