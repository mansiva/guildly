import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { getNudgeForMilestone } from '@/lib/nudges';
import { checkBadges, BadgeDef } from '@/lib/badges';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { questId, groupId, userId, value } = await req.json();

    if (!questId || !groupId || !userId || typeof value !== 'number') {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const adminDb = getAdminDb();
    const questRef = adminDb.doc(`groups/${groupId}/quests/${questId}`);
    const questSnap = await questRef.get();

    if (!questSnap.exists) {
      return NextResponse.json({ error: 'Quest not found' }, { status: 404 });
    }

    const quest = questSnap.data()!;
    if (quest.status !== 'active') {
      return NextResponse.json({ error: 'Quest is not active' }, { status: 400 });
    }

    // ── Progress tracking ──────────────────────────────────────────────────
    const prevValue = quest.currentValue || 0;
    const newValue = prevValue + value;
    const completed = newValue >= quest.targetValue;
    const prevPct = Math.round((prevValue / quest.targetValue) * 100);
    const newPct = Math.round((newValue / quest.targetValue) * 100);

    // ── Immediate partial XP (50% of proportional share) ──────────────────
    const questXp = quest.xpReward || 100;
    const contributionPct = Math.min(value / quest.targetValue, 1);
    const immediateXp = Math.floor(contributionPct * questXp * 0.5);
    const deferredXp = Math.floor(contributionPct * questXp * 0.5);

    // ── User doc read for badge checks ────────────────────────────────────
    const userRef = adminDb.doc(`users/${userId}`);
    const userSnap = await userRef.get();
    const userData = userSnap.data() || {};
    const oldLogsCount = userData.logsCount || 0;
    const newLogsCount = oldLogsCount + 1;
    const alreadyEarned: string[] = (userData.badges || []).map((b: { id: string }) => b.id);

    // ── Update quest ───────────────────────────────────────────────────────
    await questRef.update({
      currentValue: newValue,
      [`contributions.${userId}`]: FieldValue.increment(value),
      [`xpDeferred.${userId}`]: FieldValue.increment(deferredXp),
      ...(completed ? { status: 'completed' } : {}),
    });

    // ── Award immediate XP + increment logsCount ──────────────────────────
    const nudge = getNudgeForMilestone(newPct);
    const nudgeText = nudge ? `${nudge.emoji} ${nudge.message}` : undefined;

    // Check Contributor badges
    const newContribBadges = checkBadges('logsCount', oldLogsCount, newLogsCount, alreadyEarned);
    const badgeXp = newContribBadges.reduce((sum, b) => sum + b.xpReward, 0);
    const newBadgeObjs = newContribBadges.map(b => ({
      id: b.id, name: b.name, description: b.description,
      emoji: b.emoji, tier: b.tier, earnedAt: new Date().toISOString(),
    }));

    await userRef.update({
      xp: FieldValue.increment(immediateXp + badgeXp),
      logsCount: FieldValue.increment(1),
      ...(newBadgeObjs.length > 0 ? { badges: FieldValue.arrayUnion(...newBadgeObjs) } : {}),
    });

    // ── Add feed entry ─────────────────────────────────────────────────────
    await adminDb.collection(`groups/${groupId}/feed`).add({
      groupId, questId,
      questTitle: quest.title,
      userId,
      userName: userData.displayName || 'Someone',
      userPhoto: userData.photoURL || null,
      value, unit: quest.unit,
      createdAt: FieldValue.serverTimestamp(),
      ...(nudgeText ? { nudge: nudgeText } : {}),
    });

    // Badge feed entries
    for (const badge of newContribBadges) {
      await adminDb.collection(`groups/${groupId}/feed`).add({
        type: 'badge',
        groupId, questId: '', questTitle: '',
        userId, userName: userData.displayName || 'Someone',
        userPhoto: userData.photoURL || null,
        value: 0, unit: '',
        nudge: `${badge.emoji} earned the ${badge.name} badge (Tier ${badge.tier})! +${badge.xpReward} XP`,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    // ── Quest completion logic ─────────────────────────────────────────────
    if (completed) {
      // Re-read quest to get final contributions (including this update)
      const finalSnap = await questRef.get();
      const finalQuest = finalSnap.data()!;
      const contributions = finalQuest.contributions as Record<string, number> || {};
      const xpDeferred = finalQuest.xpDeferred as Record<string, number> || {};

      // Find top contributor
      let topUid = '';
      let topAmount = 0;
      for (const [uid, amount] of Object.entries(contributions)) {
        if (amount > topAmount) { topAmount = amount; topUid = uid; }
      }

      // Mark quest with top contributor
      await questRef.update({ topContributor: topUid });

      // Pay out deferred XP to all contributors + top contributor bonus
      const completionUpdates: Promise<unknown>[] = [];
      for (const [uid, deferred] of Object.entries(xpDeferred)) {
        const bonus = uid === topUid ? Math.floor(questXp * 0.10) : 0;
        const totalPayout = (deferred || 0) + bonus;
        if (totalPayout <= 0) continue;

        const cUserRef = adminDb.doc(`users/${uid}`);
        const cUserSnap = await cUserRef.get();
        const cUserData = cUserSnap.data() || {};
        const cAlreadyEarned: string[] = (cUserData.badges || []).map((b: { id: string }) => b.id);
        const oldCompleted = cUserData.questsCompleted || 0;
        const oldLed = cUserData.questsLed || 0;

        // Check Quest Completer badge (must have contributed — they have deferred XP so they did)
        const newCompletedBadges = checkBadges('questsCompleted', oldCompleted, oldCompleted + 1, cAlreadyEarned);
        // Check Quest Leader badge
        const newLeaderBadges = uid === topUid
          ? checkBadges('questsLed', oldLed, oldLed + 1, [...cAlreadyEarned, ...newCompletedBadges.map(b => b.id)])
          : [];

        const allNewBadges = [...newCompletedBadges, ...newLeaderBadges];
        const cBadgeXp = allNewBadges.reduce((sum, b) => sum + b.xpReward, 0);
        const cBadgeObjs = allNewBadges.map((b: BadgeDef) => ({
          id: b.id, name: b.name, description: b.description,
          emoji: b.emoji, tier: b.tier, earnedAt: new Date().toISOString(),
        }));

        completionUpdates.push(cUserRef.update({
          xp: FieldValue.increment(totalPayout + cBadgeXp),
          questsCompleted: FieldValue.increment(1),
          ...(uid === topUid ? { questsLed: FieldValue.increment(1) } : {}),
          ...(cBadgeObjs.length > 0 ? { badges: FieldValue.arrayUnion(...cBadgeObjs) } : {}),
        }));

        // Badge feed entries for completion badges
        for (const badge of allNewBadges) {
          completionUpdates.push(adminDb.collection(`groups/${groupId}/feed`).add({
            type: 'badge',
            groupId, questId: '', questTitle: '',
            userId: uid, userName: cUserData.displayName || 'Someone',
            userPhoto: cUserData.photoURL || null,
            value: 0, unit: '',
            nudge: `${badge.emoji} earned the ${badge.name} badge (Tier ${badge.tier})! +${badge.xpReward} XP`,
            createdAt: FieldValue.serverTimestamp(),
          }));
        }
      }

      await Promise.all(completionUpdates);

      // Group XP
      await adminDb.doc(`groups/${groupId}`).update({
        xp: FieldValue.increment(questXp),
      });

      // Top contributor feed callout
      const topUserSnap = await adminDb.doc(`users/${topUid}`).get();
      const topUserName = topUserSnap.data()?.displayName || 'Someone';

      await adminDb.collection(`groups/${groupId}/feed`).add({
        groupId, questId, questTitle: quest.title,
        userId: 'system', userName: 'Guildly',
        value: 0, unit: '',
        nudge: `🏆 Quest complete! "${quest.title}" — ${questXp} XP earned! ⭐ ${topUserName} led the way as top contributor!`,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    return NextResponse.json({
      success: true,
      completed,
      newValue,
      immediateXp,
      newBadges: newBadgeObjs,
    });
  } catch (err: unknown) {
    console.error('Log progress error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
