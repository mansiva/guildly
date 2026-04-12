export type QuestDifficulty = 'easy' | 'medium' | 'hard';
export type QuestDuration = 'daily' | 'weekly' | 'monthly' | 'custom';

// XP matrix: difficulty × duration
const XP_MATRIX: Record<QuestDifficulty, Record<'day' | 'week' | 'month' | 'long', number>> = {
  easy:   { day: 10,  week: 40,  month: 120, long: 180 },
  medium: { day: 25,  week: 100, month: 300, long: 450 },
  hard:   { day: 60,  week: 250, month: 750, long: 1100 },
};

export function computeQuestXp(difficulty: QuestDifficulty, deadline: Date): number {
  const days = Math.ceil((deadline.getTime() - Date.now()) / 86400000);
  const bucket = days <= 1 ? 'day' : days <= 7 ? 'week' : days <= 31 ? 'month' : 'long';
  return XP_MATRIX[difficulty][bucket];
}

export function deadlineForDuration(duration: QuestDuration): Date {
  const now = new Date();
  if (duration === 'daily') {
    const d = new Date(now);
    d.setHours(23, 59, 59, 999);
    return d;
  }
  if (duration === 'weekly') {
    const d = new Date(now);
    const daysUntilSunday = (7 - d.getDay()) % 7 || 7;
    d.setDate(d.getDate() + daysUntilSunday);
    d.setHours(23, 59, 59, 999);
    return d;
  }
  if (duration === 'monthly') {
    const d = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return d;
  }
  // custom — caller provides deadline
  return now;
}

export const DIFFICULTY_LABELS: Record<QuestDifficulty, string> = {
  easy: '🟢 Easy',
  medium: '🟡 Medium',
  hard: '🔴 Hard',
};

export const DIFFICULTY_DESCRIPTIONS: Record<QuestDifficulty, string> = {
  easy: 'Low effort, achievable by anyone',
  medium: 'Requires real commitment',
  hard: 'Serious challenge, high reward',
};
