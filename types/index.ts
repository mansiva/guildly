export type QuestCategory = 'exercise' | 'learning' | 'art' | 'music' | 'wellness' | 'social' | 'custom';

export interface User {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  xp: number;
  level: number;
  badges: Badge[];
  logsCount: number;
  questsCompleted: number;
  questsLed: number;
  nudgesGiven: number;
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
  xpInGroup?: number;
  status?: 'active' | 'removed';
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
  difficulty?: 'easy' | 'medium' | 'hard';
  duration?: 'daily' | 'weekly' | 'monthly' | 'custom';
  targetValue: number;
  unit: string;
  currentValue: number;
  deadline: Date;
  createdAt: Date;
  createdBy: string;
  contributions: Record<string, number>; // userId -> value
  xpDeferred: Record<string, number>;    // userId -> deferred XP not yet paid
  topContributor?: string;               // userId of top contributor on completion
  status: 'active' | 'completed' | 'failed';
  xpReward: number;
  renewalCount?: number;        // 0 = never renewed, 1 = once, 2 = twice
  bonusXpMultiplier?: number;   // 1.0 → 0.5 → 0.0 across renewals
  originalDeadline?: Date;      // deadline at quest creation
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
  type?: 'log' | 'badge' | 'completion';
  questId: string;
  userId: string;
  value: number;
  createdAt: Date;
  nudge?: string;
  reactions?: Record<string, string[]>; // emoji -> uid[]
}

export interface AppNotification {
  id: string;
  type: 'reaction' | 'quest_complete' | 'quest_failed' | 'nudge';
  read: boolean;
  createdAt: Date;
  // reaction
  fromUid?: string;
  fromName?: string;
  emoji?: string;
  feedEntryId?: string;
  questTitle?: string;
  groupId?: string;
  groupName?: string;
}

export interface Follow {
  followerId: string;
  followeeId: string;
  createdAt: Date;
}

export interface Nudge {
  id: string;
  message: string;
  emoji: string;
  trigger: 'milestone' | 'reminder' | 'completion' | 'join';
}
