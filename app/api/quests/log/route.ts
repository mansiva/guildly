import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { getNudgeForMilestone } from '@/lib/nudges';

export async function POST(req: NextRequest) {
  try {
    const { questId, groupId, userId, value } = await req.json();

    if (!questId || !groupId || !userId || typeof value !== 'number') {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const questRef = adminDb.doc(`groups/${groupId}/quests/${questId}`);
    const questSnap = await questRef.get();

    if (!questSnap.exists) {
      return NextResponse.json({ error: 'Quest not found' }, { status: 404 });
    }

    const quest = questSnap.data()!;

    if (quest.status !== 'active') {
      return NextResponse.json({ error: 'Quest is not active' }, { status: 400 });
    }

    const prevValue = quest.currentValue || 0;
    const newValue = prevValue + value;
    const completed = newValue >= quest.targetValue;
    const prevPct = Math.round((prevValue / quest.targetValue) * 100);
    const newPct = Math.round((newValue / quest.targetValue) * 100);

    // Update quest
    await questRef.update({
      currentValue: newValue,
      [`contributions.${userId}`]: FieldValue.increment(value),
      ...(completed ? { status: 'completed' } : {}),
    });

    // Get user info
    const userSnap = await adminDb.doc(`users/${userId}`).get();
    const userData = userSnap.data() || {};

    // Determine nudge
    const nudge = getNudgeForMilestone(newPct);
    const nudgeText = nudge ? `${nudge.emoji} ${nudge.message}` : undefined;

    // Add to feed
    await adminDb.collection(`groups/${groupId}/feed`).add({
      groupId,
      questId,
      questTitle: quest.title,
      userId,
      userName: userData.displayName || 'Someone',
      userPhoto: userData.photoURL || null,
      value,
      unit: quest.unit,
      createdAt: FieldValue.serverTimestamp(),
      ...(nudgeText ? { nudge: nudgeText } : {}),
    });

    // Award XP on completion
    if (completed) {
      const xpReward = quest.xpReward || 100;
      // Award to all contributors
      const contributions = quest.contributions || {};
      const totalContrib = Object.values(contributions as Record<string, number>).reduce((a, b) => a + b, 0) + value;

      for (const [uid, contrib] of Object.entries({ ...contributions, [userId]: (contributions[userId] || 0) + value } as Record<string, number>)) {
        const share = totalContrib > 0 ? (contrib / totalContrib) : (1 / Object.keys(contributions).length);
        const userXp = Math.round(xpReward * share);
        await adminDb.doc(`users/${uid}`).update({
          xp: FieldValue.increment(userXp),
        });
      }

      // Group XP
      await adminDb.doc(`groups/${groupId}`).update({
        xp: FieldValue.increment(xpReward),
      });

      // Feed completion nudge
      await adminDb.collection(`groups/${groupId}/feed`).add({
        groupId,
        questId,
        questTitle: quest.title,
        userId: 'system',
        userName: 'Guildly',
        value: 0,
        unit: '',
        nudge: `🏆 Quest complete! "${quest.title}" — the group earned ${xpReward} XP!`,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    return NextResponse.json({ success: true, completed, newValue });
  } catch (err: unknown) {
    console.error('Log progress error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
