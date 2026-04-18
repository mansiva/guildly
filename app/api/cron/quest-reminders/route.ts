import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, getAdminMessaging } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // ── Auth: require secret header or query param ─────────────────────────
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  const querySecret = req.nextUrl.searchParams.get('secret');

  if (secret && authHeader !== `Bearer ${secret}` && querySecret !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getAdminDb();
  const messaging = getAdminMessaging();

  const now = new Date();
  // Window: quests ending in the next 13–25 hours (noon run catches midnight deadlines)
  const windowStart = new Date(now.getTime() + 13 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);
  const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD dedup key

  const results = { checked: 0, skipped: 0, sent: 0, errors: 0 };

  try {
    // Fetch all active quests across all groups via collectionGroup query.
    // Filtering deadline client-side to avoid needing a composite index.
    const questsSnap = await db.collectionGroup('quests')
      .where('status', '==', 'active')
      .get();

    for (const questDoc of questsSnap.docs) {
      results.checked++;
      const quest = questDoc.data();

      // Check deadline falls in window
      const deadline: Date = quest.deadline?.toDate?.() ?? new Date(0);
      if (deadline < windowStart || deadline > windowEnd) {
        results.skipped++;
        continue;
      }

      // Skip if already 100% complete
      const pct = quest.targetValue > 0 ? quest.currentValue / quest.targetValue : 0;
      if (pct >= 1) {
        results.skipped++;
        continue;
      }

      // Dedup: skip if we already sent a reminder today for this quest
      if (quest.reminderSentDate === todayStr) {
        results.skipped++;
        continue;
      }

      const groupId = quest.groupId as string;
      const questTitle = quest.title as string;
      const current = quest.currentValue as number;
      const target = quest.targetValue as number;
      const unit = (quest.unit as string) || '';
      const pctLabel = Math.round(pct * 100);

      // Get group name
      let groupName = 'your group';
      try {
        const groupSnap = await db.doc(`groups/${groupId}`).get();
        groupName = groupSnap.data()?.name ?? groupName;
      } catch { /* non-fatal */ }

      // Get all active group members with FCM tokens
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

      if (tokens.length === 0) {
        results.skipped++;
        continue;
      }

      // Build notification
      const remaining = target - current;
      const body = pct === 0
        ? `${questTitle} ends tonight — no one has logged yet. Time to start! 💪`
        : `${questTitle} ends tonight — ${pctLabel}% done (${remaining} ${unit} to go). Push hard! ⚡`;

      try {
        const response = await messaging.sendEachForMulticast({
          tokens,
          notification: {
            title: `⏰ Quest ending tonight — ${groupName}`,
            body,
          },
          webpush: {
            notification: { icon: '/icon-192.png' },
          },
        });

        results.sent += response.successCount;
        results.errors += response.failureCount;

        // Mark dedup on quest doc
        await questDoc.ref.update({ reminderSentDate: todayStr });

      } catch (err) {
        console.error(`[QuestReminder] FCM failed for quest ${questDoc.id}:`, err);
        results.errors++;
      }
    }

    console.log('[QuestReminder] Done:', results);

    // ── Overdue quest renewal / failure ───────────────────────────────────
    const renewalResults = { checked: 0, renewed: 0, failed: 0, errors: 0 };
    try {
      const overdueSnap = await db.collectionGroup('quests')
        .where('status', '==', 'active')
        .get();

      for (const questDoc of overdueSnap.docs) {
        const quest = questDoc.data();
        const deadline: Date = quest.deadline?.toDate?.() ?? new Date(0);
        if (deadline > now) continue; // not overdue yet

        // Already 100% complete — log route handles completion, skip
        const pct = quest.targetValue > 0 ? (quest.currentValue || 0) / quest.targetValue : 0;
        if (pct >= 1) continue;

        renewalResults.checked++;
        const groupId = quest.groupId as string;
        const renewalCount: number = quest.renewalCount ?? 0;

        if (renewalCount >= 2) {
          // 3rd failure — mark as failed
          try {
            await questDoc.ref.update({ status: 'failed', failedAt: now });
            renewalResults.failed++;

            // Notify group members
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

            // Feed entry
            await db.collection(`groups/${groupId}/feed`).add({
              type: 'quest_failed',
              userId: 'system',
              questId: questDoc.id,
              value: 0,
              nudge: `❌ Quest failed: "${quest.title}" — not completed after 3 attempts.`,
              createdAt: now,
            });

            if (tokens.length > 0) {
              await messaging.sendEachForMulticast({
                tokens,
                notification: {
                  title: '❌ Quest Failed',
                  body: `"${quest.title}" wasn't completed in time after 3 attempts and has been marked as failed.`,
                },
                webpush: { notification: { icon: '/icon-192.png' } },
              }).catch(err => console.error('[QuestRenewal] FCM failed notice error:', err));
            }
          } catch (err) {
            console.error(`[QuestRenewal] Failed to mark quest ${questDoc.id} as failed:`, err);
            renewalResults.errors++;
          }
          continue;
        }

        // Renew the quest
        try {
          const newRenewalCount = renewalCount + 1;
          // bonusXpMultiplier: 1.0 → 0.5 → 0.0
          const newBonusMultiplier = newRenewalCount >= 2 ? 0.0 : 0.5;

          // Compute new deadline: same duration as original
          const originalDeadline: Date = quest.originalDeadline?.toDate?.() ?? deadline;
          const originalDurationMs = originalDeadline.getTime() - (quest.createdAt?.toDate?.()?.getTime?.() ?? (originalDeadline.getTime() - 7 * 86400000));
          const newDeadline = new Date(deadline.getTime() + Math.max(originalDurationMs, 86400000));

          await questDoc.ref.update({
            deadline: newDeadline,
            renewalCount: newRenewalCount,
            bonusXpMultiplier: newBonusMultiplier,
          });
          renewalResults.renewed++;

          // Get group name
          let groupName = 'your group';
          try {
            const groupSnap = await db.doc(`groups/${groupId}`).get();
            groupName = groupSnap.data()?.name ?? groupName;
          } catch { /* non-fatal */ }

          // Get all members + tokens
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

          const bonusLabel = newBonusMultiplier === 0.0
            ? 'no completion bonus (badges only)'
            : '50% completion bonus remaining';

          // Feed entry
          await db.collection(`groups/${groupId}/feed`).add({
            type: 'quest_renewed',
            userId: 'system',
            questId: questDoc.id,
            value: 0,
            nudge: `⏰ Quest renewed: "${quest.title}" got another ${Math.round(Math.max(originalDurationMs, 86400000) / 86400000)} days — but ${bonusLabel}.`,
            createdAt: now,
          });

          if (tokens.length > 0) {
            await messaging.sendEachForMulticast({
              tokens,
              notification: {
                title: `⏰ Quest Renewed — ${groupName}`,
                body: `"${quest.title}" wasn't finished in time. You have another chance — but the completion bonus is reduced. ${newBonusMultiplier === 0 ? 'Complete it for the badges! 🏅' : '⚡ Finish it!'}`,
              },
              webpush: { notification: { icon: '/icon-192.png' } },
            }).catch(err => console.error('[QuestRenewal] FCM renewal notice error:', err));
          }
        } catch (err) {
          console.error(`[QuestRenewal] Failed to renew quest ${questDoc.id}:`, err);
          renewalResults.errors++;
        }
      }
    } catch (err) {
      console.error('[QuestRenewal] Fatal error in renewal block:', err);
    }

    console.log('[QuestRenewal] Done:', renewalResults);
    return NextResponse.json({ ok: true, reminders: results, renewals: renewalResults });

  } catch (err) {
    console.error('[QuestReminder] Fatal error:', err);
    return NextResponse.json({ error: 'Internal error', details: String(err) }, { status: 500 });
  }
}
