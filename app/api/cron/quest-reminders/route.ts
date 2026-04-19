import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, getAdminMessaging } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { deadlineForDuration } from '@/lib/questXp';

export const dynamic = 'force-dynamic';

// Single daily cron — runs at 21:01 UTC (22:01 CET).
// 1. Reminder: quests ending within the next ~24h → "Last day to complete!"
// 2. End-of-week: overdue quests → renew / fail / repeat

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  const querySecret = req.nextUrl.searchParams.get('secret');
  if (secret && authHeader !== `Bearer ${secret}` && querySecret !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getAdminDb();
  const messaging = getAdminMessaging();
  const now = new Date();

  // Reminder window: quests whose deadline is in the next 24–25h
  const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000);
  const windowEnd   = new Date(now.getTime() + 25 * 60 * 60 * 1000);
  const todayStr    = now.toISOString().slice(0, 10);

  const reminders = { checked: 0, skipped: 0, sent: 0, errors: 0 };
  const renewals  = { checked: 0, renewed: 0, failed: 0, repeated: 0, errors: 0 };

  // ── Helper: FCM tokens for all active group members ────────────────────
  async function getMemberTokens(groupId: string): Promise<string[]> {
    const membersSnap = await db.collection('groupMembers')
      .where('groupId', '==', groupId)
      .where('status', '!=', 'removed')
      .get();
    const tokens: string[] = [];
    await Promise.all(membersSnap.docs.map(async m => {
      const uid = m.data().userId as string;
      const userSnap = await db.doc(`users/${uid}`).get();
      const token = userSnap.data()?.fcmToken as string | undefined;
      if (token) tokens.push(token);
    }));
    return tokens;
  }

  async function push(tokens: string[], title: string, body: string) {
    if (tokens.length === 0) return;
    await messaging.sendEachForMulticast({
      tokens,
      notification: { title, body },
      webpush: { notification: { icon: '/icon-192.png' } },
    }).catch(err => console.error('[QuestCron] FCM error:', err));
  }

  async function createRepeat(
    groupId: string,
    quest: FirebaseFirestore.DocumentData,
    sourceQuestId: string,
    tokens: string[],
    groupName: string,
  ) {
    const newDeadline = deadlineForDuration(quest.duration, 'this');
    const newQuestRef = await db.collection(`groups/${groupId}/quests`).add({
      groupId,
      title: quest.title,
      description: quest.description ?? '',
      category: quest.category ?? 'custom',
      targetValue: quest.targetValue,
      unit: quest.unit,
      difficulty: quest.difficulty,
      duration: quest.duration,
      currentValue: 0,
      contributions: {},
      xpDeferred: {},
      status: 'active',
      xpReward: quest.xpReward,
      deadline: newDeadline,
      originalDeadline: newDeadline,
      renewalCount: 0,
      bonusXpMultiplier: 1.0,
      repeat: true,
      repeatSpawned: false,
      repeatedFromQuestId: sourceQuestId,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: quest.createdBy ?? 'system',
    });

    await db.doc(`groups/${groupId}/quests/${sourceQuestId}`).update({ repeatSpawned: true });

    await db.collection(`groups/${groupId}/feed`).add({
      type: 'quest_repeat', userId: 'system', questId: newQuestRef.id, value: 0,
      nudge: `🔁 "${quest.title}" is back for another ${quest.duration === 'weekly' ? 'week' : 'month'}!`,
      createdAt: FieldValue.serverTimestamp(),
    });

    await push(tokens,
      `🔁 New Quest — ${groupName}`,
      `"${quest.title}" is back for another ${quest.duration === 'weekly' ? 'week' : 'month'}! Good luck 💪`
    );
  }

  function nextDeadlineAfter(prevDeadline: Date, duration: string | undefined): Date {
    if (duration === 'weekly') {
      // Snap to next Friday 20:00 UTC after prevDeadline
      const d = new Date(prevDeadline.getTime() + 7 * 24 * 60 * 60 * 1000);
      const day = d.getUTCDay();
      const daysUntilFriday = (5 - day + 7) % 7;
      d.setUTCDate(d.getUTCDate() + daysUntilFriday);
      d.setUTCHours(20, 0, 0, 0);
      return d;
    }
    if (duration === 'monthly') {
      // Last day of next month at 20:00 UTC
      const d = new Date(prevDeadline);
      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 2, 0, 20, 0, 0, 0));
    }
    // daily: next day at 20:00 UTC
    const d = new Date(prevDeadline.getTime() + 86400000);
    d.setUTCHours(20, 0, 0, 0);
    return d;
  }

  // ── Process all groups ─────────────────────────────────────────────────
  const groupsSnap = await db.collection('groups').get();

  for (const groupDoc of groupsSnap.docs) {
    const groupId   = groupDoc.id;
    const groupName: string = groupDoc.data()?.name ?? 'your group';

    const activeSnap = await db.collection(`groups/${groupId}/quests`)
      .where('status', '==', 'active')
      .get();

    for (const questDoc of activeSnap.docs) {
      const quest    = questDoc.data();
      const deadline: Date = quest.deadline?.toDate?.() ?? new Date(0);
      const pct      = quest.targetValue > 0 ? (quest.currentValue || 0) / quest.targetValue : 0;

      if (deadline > now) {
        // ── Reminder: deadline within next 24-25h ──────────────────────
        reminders.checked++;
        if (deadline < windowStart || deadline > windowEnd) { reminders.skipped++; continue; }
        if (pct >= 1)                                        { reminders.skipped++; continue; }
        if (quest.reminderSentDate === todayStr)             { reminders.skipped++; continue; }

        const tokens = await getMemberTokens(groupId);
        if (tokens.length === 0) { reminders.skipped++; continue; }

        const remaining  = quest.targetValue - (quest.currentValue || 0);
        const pctLabel   = Math.round(pct * 100);
        const body = pct === 0
          ? `"${quest.title}" ends tomorrow — no one has logged yet. Last chance! 💪`
          : `"${quest.title}" ends tomorrow — ${pctLabel}% done (${remaining} ${quest.unit || ''} to go). Final push! ⚡`;

        try {
          const response = await messaging.sendEachForMulticast({
            tokens,
            notification: { title: `⏰ Last day — ${groupName}`, body },
            webpush: { notification: { icon: '/icon-192.png' } },
          });
          reminders.sent += response.successCount;
          reminders.errors += response.failureCount;
          await questDoc.ref.update({ reminderSentDate: todayStr });
        } catch (err) {
          console.error(`[QuestCron] Reminder FCM failed for ${questDoc.id}:`, err);
          reminders.errors++;
        }

      } else {
        // ── End-of-week: overdue quest ─────────────────────────────────
        if (pct >= 1) continue; // already completed — log route handled it

        renewals.checked++;
        const renewalCount: number = quest.renewalCount ?? 0;
        const tokens = await getMemberTokens(groupId);

        if (renewalCount >= 2) {
          // 3rd failure → mark failed
          try {
            await questDoc.ref.update({ status: 'failed', failedAt: now });
            renewals.failed++;

            await db.collection(`groups/${groupId}/feed`).add({
              type: 'quest_failed', userId: 'system', questId: questDoc.id, value: 0,
              nudge: `❌ Quest failed: "${quest.title}" — not completed after 3 attempts.`,
              createdAt: FieldValue.serverTimestamp(),
            });

            await push(tokens, '❌ Quest Failed',
              `"${quest.title}" wasn't completed after 3 attempts and has been marked as failed.`);

            // Repeat even after final failure
            if (quest.repeat && quest.duration && quest.duration !== 'custom') {
              await createRepeat(groupId, quest, questDoc.id, tokens, groupName);
              renewals.repeated++;
            }
          } catch (err) {
            console.error(`[QuestCron] Failed to mark ${questDoc.id} as failed:`, err);
            renewals.errors++;
          }
          continue;
        }

        // Renew
        try {
          const newRenewalCount   = renewalCount + 1;
          const newBonusMultiplier = newRenewalCount >= 2 ? 0.0 : 0.5;
          const newDeadline        = nextDeadlineAfter(deadline, quest.duration);

          await questDoc.ref.update({
            deadline: newDeadline,
            renewalCount: newRenewalCount,
            bonusXpMultiplier: newBonusMultiplier,
          });
          renewals.renewed++;

          const bonusLabel = newBonusMultiplier === 0
            ? 'no completion bonus — badges only 🏅'
            : 'completion bonus halved ⚡';

          await db.collection(`groups/${groupId}/feed`).add({
            type: 'quest_renewed', userId: 'system', questId: questDoc.id, value: 0,
            nudge: `⏰ Quest renewed: "${quest.title}" — ${bonusLabel}. One more week!`,
            createdAt: FieldValue.serverTimestamp(),
          });

          await push(tokens, `⏰ Quest Renewed — ${groupName}`,
            `"${quest.title}" wasn't finished in time. ${newBonusMultiplier === 0 ? 'Complete it for the badges!' : 'Completion bonus is halved — finish it!'}`);
        } catch (err) {
          console.error(`[QuestCron] Failed to renew ${questDoc.id}:`, err);
          renewals.errors++;
        }
      }
    }

    // ── Completed quests with repeat: spawn next cycle ───────────────────
    const completedSnap = await db.collection(`groups/${groupId}/quests`)
      .where('status', '==', 'completed')
      .where('repeat', '==', true)
      .get();

    for (const questDoc of completedSnap.docs) {
      const quest = questDoc.data();
      if (!quest.duration || quest.duration === 'custom') continue;
      if (quest.repeatSpawned) continue;

      // Only spawn if quest completed in last cycle (deadline was in the last 25h)
      const deadline: Date = quest.deadline?.toDate?.() ?? new Date(0);
      const msSinceDeadline = now.getTime() - deadline.getTime();
      if (msSinceDeadline < 0 || msSinceDeadline > 25 * 60 * 60 * 1000) continue;

      try {
        const tokens = await getMemberTokens(groupId);
        await createRepeat(groupId, quest, questDoc.id, tokens, groupName);
        renewals.repeated++;
      } catch (err) {
        console.error(`[QuestCron] Failed to create repeat for ${questDoc.id}:`, err);
        renewals.errors++;
      }
    }
  }

  console.log('[QuestCron] Reminders:', reminders, '| Renewals:', renewals);
  return NextResponse.json({ ok: true, reminders, renewals });
}
