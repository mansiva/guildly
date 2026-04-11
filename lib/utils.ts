import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function xpToLevel(xp: number): { level: number; progress: number; nextLevelXp: number } {
  // Each level requires level * 100 XP
  let level = 1;
  let totalRequired = 0;
  while (totalRequired + level * 100 <= xp) {
    totalRequired += level * 100;
    level++;
  }
  const nextLevelXp = level * 100;
  const progress = xp - totalRequired;
  return { level, progress, nextLevelXp };
}

export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

export function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}
