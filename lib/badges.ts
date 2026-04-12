export type BadgeId =
  | 'contributor_1' | 'contributor_2' | 'contributor_3'
  | 'completer_1' | 'completer_2' | 'completer_3'
  | 'leader_1' | 'leader_2' | 'leader_3'
  | 'nudger_1' | 'nudger_2' | 'nudger_3';

export interface BadgeDef {
  id: BadgeId;
  name: string;
  description: string;
  emoji: string;
  tier: 1 | 2 | 3;
  xpReward: number;
  // which user stat field to check and threshold
  stat: 'logsCount' | 'questsCompleted' | 'questsLed' | 'nudgesGiven';
  threshold: number;
}

export const BADGE_DEFS: BadgeDef[] = [
  // Contributor — log entries
  { id: 'contributor_1', name: 'First Step',      emoji: '📝', tier: 1, xpReward: 10,  stat: 'logsCount',       threshold: 1,   description: 'Logged your first progress entry' },
  { id: 'contributor_2', name: 'On a Roll',        emoji: '📝', tier: 2, xpReward: 50,  stat: 'logsCount',       threshold: 25,  description: 'Logged 25 progress entries' },
  { id: 'contributor_3', name: 'Relentless',       emoji: '📝', tier: 3, xpReward: 150, stat: 'logsCount',       threshold: 100, description: 'Logged 100 progress entries' },

  // Quest Completer — quests completed with ≥1 contribution
  { id: 'completer_1',   name: 'Finisher',         emoji: '✅', tier: 1, xpReward: 25,  stat: 'questsCompleted', threshold: 1,   description: 'Completed your first quest' },
  { id: 'completer_2',   name: 'Quest Veteran',    emoji: '✅', tier: 2, xpReward: 100, stat: 'questsCompleted', threshold: 5,   description: 'Completed 5 quests' },
  { id: 'completer_3',   name: 'Quest Master',     emoji: '✅', tier: 3, xpReward: 300, stat: 'questsCompleted', threshold: 15,  description: 'Completed 15 quests' },

  // Quest Leader — top contributor on a completed quest
  { id: 'leader_1',      name: 'Point Guard',      emoji: '⚔️', tier: 1, xpReward: 50,  stat: 'questsLed',       threshold: 1,   description: 'Led a quest as top contributor' },
  { id: 'leader_2',      name: 'Guild Champion',   emoji: '⚔️', tier: 2, xpReward: 200, stat: 'questsLed',       threshold: 5,   description: 'Led 5 quests as top contributor' },
  { id: 'leader_3',      name: 'Legendary Leader', emoji: '⚔️', tier: 3, xpReward: 500, stat: 'questsLed',       threshold: 15,  description: 'Led 15 quests as top contributor' },

  // Nudger — encourage others (placeholder, tracked for future)
  { id: 'nudger_1',      name: 'Motivator',        emoji: '📣', tier: 1, xpReward: 15,  stat: 'nudgesGiven',     threshold: 1,   description: 'Encouraged a teammate' },
  { id: 'nudger_2',      name: 'Hype Machine',     emoji: '📣', tier: 2, xpReward: 75,  stat: 'nudgesGiven',     threshold: 10,  description: 'Encouraged 10 teammates' },
  { id: 'nudger_3',      name: 'Guild Spirit',     emoji: '📣', tier: 3, xpReward: 200, stat: 'nudgesGiven',     threshold: 50,  description: 'Encouraged 50 teammates' },
];

// Returns badges that should be newly awarded given old and new stat values
export function checkBadges(
  stat: BadgeDef['stat'],
  oldValue: number,
  newValue: number,
  alreadyEarned: string[],
): BadgeDef[] {
  return BADGE_DEFS.filter(b =>
    b.stat === stat &&
    oldValue < b.threshold &&
    newValue >= b.threshold &&
    !alreadyEarned.includes(b.id)
  );
}
