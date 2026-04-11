import { Nudge } from '@/types';

export const NUDGES: Nudge[] = [
  { id: '1', message: "You're on fire! Keep it up!", emoji: '🔥', trigger: 'milestone' },
  { id: '2', message: "Halfway there — the group is counting on you!", emoji: '💪', trigger: 'milestone' },
  { id: '3', message: "High five! Great contribution!", emoji: '🙌', trigger: 'milestone' },
  { id: '4', message: "The group needs you — every bit counts!", emoji: '⚡', trigger: 'reminder' },
  { id: '5', message: "Don't break the streak now!", emoji: '🎯', trigger: 'reminder' },
  { id: '6', message: "Your team misses you — come back!", emoji: '👀', trigger: 'reminder' },
  { id: '7', message: "Quest complete! You crushed it together!", emoji: '🏆', trigger: 'completion' },
  { id: '8', message: "Legend! The group hit the target!", emoji: '🎉', trigger: 'completion' },
  { id: '9', message: "Welcome to the group! Time to make your mark!", emoji: '🚀', trigger: 'join' },
  { id: '10', message: "A new hero has joined the party!", emoji: '⭐', trigger: 'join' },
];

export function getNudgeForMilestone(percent: number): Nudge | null {
  if (percent >= 100) return NUDGES.find(n => n.trigger === 'completion') || null;
  if (percent >= 50) return NUDGES[1];
  if (percent >= 25) return NUDGES[0];
  return null;
}

export function getRandomNudge(trigger: Nudge['trigger']): Nudge {
  const pool = NUDGES.filter(n => n.trigger === trigger);
  return pool[Math.floor(Math.random() * pool.length)];
}
