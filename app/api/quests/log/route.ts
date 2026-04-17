import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, getAdminMessaging } from '@/lib/firebase-admin';
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

    // Block removed members from contributing
    const memberSnap = await adminDb.doc(`groupMembers/${groupId}_${userId}`).get();
    if (!memberSnap.exists || memberSnap.data()?.status === 'removed') {
      return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 });
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

    const monthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const monthReset = userData.xpMonthKey !== monthKey ? { xpMonth: immediateXp + badgeXp, xpMonthKey: monthKey } : { xpMonth: FieldValue.increment(immediateXp + badgeXp) };
    await userRef.update({
      xp: FieldValue.increment(immediateXp + badgeXp),
      logsCount: FieldValue.increment(1),
      ...monthReset,
      ...(newBadgeObjs.length > 0 ? { badges: FieldValue.arrayUnion(...newBadgeObjs) } : {}),
    });

    // Increment xpInGroup (quest XP only, not badges) and group XP
    await adminDb.doc(`groupMembers/${groupId}_${userId}`).update({
      xpInGroup: FieldValue.increment(immediateXp),
    });
    await adminDb.doc(`groups/${groupId}`).update({
      xp: FieldValue.increment(immediateXp),
    });

    // ── Add feed entry ─────────────────────────────────────────────────────
    await adminDb.collection(`groups/${groupId}/feed`).add({
      questId,
      userId,
      value,
      createdAt: FieldValue.serverTimestamp(),
      ...(nudgeText ? { nudge: nudgeText } : {}),
    });

    // Badge feed entries
    for (const badge of newContribBadges) {
      await adminDb.collection(`groups/${groupId}/feed`).add({
        type: 'badge',
        userId,
        questId: '',
        value: 0,
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
      const totalContributed = Object.values(contributions).reduce((s, v) => s + v, 0);

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
      for (const [uid, contributed] of Object.entries(contributions)) {
        const contribPct = Math.min(contributed / (finalQuest.targetValue || totalContributed), 1);
        const deferred = Math.floor(contribPct * questXp * 0.5);
        const bonus = uid === topUid ? Math.floor(questXp * 0.10) : 0;
        const totalPayout = deferred + bonus;
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

        const cMonthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
        const cMonthReset = cUserData.xpMonthKey !== cMonthKey ? { xpMonth: totalPayout + cBadgeXp, xpMonthKey: cMonthKey } : { xpMonth: FieldValue.increment(totalPayout + cBadgeXp) };
        completionUpdates.push(cUserRef.update({
          xp: FieldValue.increment(totalPayout + cBadgeXp),
          questsCompleted: FieldValue.increment(1),
          ...cMonthReset,
          ...(uid === topUid ? { questsLed: FieldValue.increment(1) } : {}),
          ...(cBadgeObjs.length > 0 ? { badges: FieldValue.arrayUnion(...cBadgeObjs) } : {}),
        }));
        completionUpdates.push(adminDb.doc(`groupMembers/${groupId}_${uid}`).update({
          xpInGroup: FieldValue.increment(deferred), // only quest XP, not badges
        }));

        // Badge feed entries for completion badges
        for (const badge of allNewBadges) {
          completionUpdates.push(adminDb.collection(`groups/${groupId}/feed`).add({
            type: 'badge',
            userId: uid,
            questId: '',
            value: 0,
            nudge: `${badge.emoji} earned the ${badge.name} badge (Tier ${badge.tier})! +${badge.xpReward} XP`,
            createdAt: FieldValue.serverTimestamp(),
          }));
        }
      }

      await Promise.all(completionUpdates);

      // Group XP: sum of all deferred payouts (mirrors what users received)
      const totalDeferredGroup = Object.entries(contributions).reduce((sum, [, contributed]) => {
        const pct = Math.min((contributed as number) / (finalQuest.targetValue || totalContributed), 1);
        return sum + Math.floor(pct * questXp * 0.5);
      }, 0);
      await adminDb.doc(`groups/${groupId}`).update({
        xp: FieldValue.increment(totalDeferredGroup),
      });

      // Top contributor feed callout
      const topUserSnap = await adminDb.doc(`users/${topUid}`).get();
      const topUserName = topUserSnap.data()?.displayName || 'Someone';

      await adminDb.collection(`groups/${groupId}/feed`).add({
        type: 'completion',
        userId: 'system',
        questId,
        value: 0,
        nudge: `🏆 Quest complete! "${quest.title}" — ${questXp} XP earned! ⭐ ${topUserName} led the way as top contributor!`,
        createdAt: FieldValue.serverTimestamp(),
      });

      // ── Notify + push all contributors (non-blocking) ─────────────────
      void (async () => {
        try {
          const completerUserSnap = await adminDb.doc(`users/${userId}`).get();
          const completerName = completerUserSnap.data()?.displayName || 'Someone';
          const groupSnap = await adminDb.doc(`groups/${groupId}`).get();
          const groupName = groupSnap.data()?.name || '';

          const notifPromises: Promise<unknown>[] = [];
          for (const [uid, contributed] of Object.entries(contributions)) {
            const participationPct = Math.round((contributed as number / (finalQuest.targetValue || 1)) * 100);
            const deferredForUid = Math.floor(
              Math.min((contributed as number) / (finalQuest.targetValue || 1), 1) * questXp * 0.5
            );

            // Write to Firestore notification inbox for every contributor
            notifPromises.push(
              adminDb.collection(`notifications/${uid}/items`).add({
                type: 'quest_complete',
                questTitle: quest.title,
                groupId,
                groupName,
                read: false,
                createdAt: FieldValue.serverTimestamp(),
              })
            );

            // FCM push only to non-triggering users (triggering user is in-app)
            if (uid === userId) continue;

            const contribUserSnap = await adminDb.doc(`users/${uid}`).get();
            const fcmToken = contribUserSnap.data()?.fcmToken as string | undefined;
            if (!fcmToken) continue;

            notifPromises.push(
              getAdminMessaging().send({
                token: fcmToken,
                notification: {
                  title: 'Quest Complete! 🏆',
                  body: `${completerName} just completed '${quest.title}'! You contributed ${participationPct}% — ${deferredForUid} XP incoming 🎉`,
                },
                webpush: { notification: { icon: '/icon-192.png' } },
              }).catch(err => console.error(`[FCM] Quest completion notify failed for ${uid}:`, err))
            );
          }
          await Promise.all(notifPromises);
        } catch (notifErr) {
          console.error('[FCM] Quest completion notification block failed:', notifErr);
        }
      })();
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
