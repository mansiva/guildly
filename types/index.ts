export type QuestCategory = 'exercise' | 'learning' | 'art' | 'music' | 'wellness' | 'social' | 'custom';

export interface User {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  xp: number;
  level: number;
  badges: Badge[];
  createdAt: Date;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  emoji: string;
  maxMembers: number;
  xp: number;
  badges: Badge[];
  createdAt: Date;
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: any;
}

export interface GroupInvite {
  id: string;
  groupId: string;
  createdBy: string;
  createdAt: Date;
  expiresAt: Date;
  used: boolean;
  usedBy?: string;
  usedAt?: Date;
}

export interface Quest {
  id: string;
  groupId: string;
  title: string;
  description: string;
  category: QuestCategory;
  targetValue: number;
  unit: string;
  currentValue: number;
  deadline: Date;
  createdAt: Date;
  createdBy: string;
  contributions: Record<string, number>; // userId -> value
  status: 'active' | 'completed' | 'failed';
  xpReward: number;
}

export interface QuestTemplate {
  id: string;
  title: string;
  description: string;
  category: QuestCategory;
  suggestedTarget: number;
  unit: string;
  xpReward: number;
  emoji: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  emoji: string;
  earnedAt: Date;
}

export interface ActivityEntry {
  id: string;
  groupId: string;
  questId: string;
  questTitle: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  value: number;
  unit: string;
  createdAt: Date;
  nudge?: string;
}

export interface Nudge {
  id: string;
  message: string;
  emoji: string;
  trigger: 'milestone' | 'reminder' | 'completion' | 'join';
}
