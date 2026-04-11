import { QuestTemplate } from '@/types';

export const QUEST_TEMPLATES: QuestTemplate[] = [
  // Exercise
  { id: 't1', title: 'Step Challenge', description: 'Walk together as a group', category: 'exercise', suggestedTarget: 50000, unit: 'steps', xpReward: 200, emoji: '👟' },
  { id: 't2', title: 'Run Together', description: 'Collectively log running distance', category: 'exercise', suggestedTarget: 50, unit: 'km', xpReward: 250, emoji: '🏃' },
  { id: 't3', title: 'Workout Streak', description: 'Complete workouts as a team', category: 'exercise', suggestedTarget: 20, unit: 'sessions', xpReward: 300, emoji: '💪' },
  { id: 't4', title: 'Bike Miles', description: 'Cycle your way to the goal', category: 'exercise', suggestedTarget: 100, unit: 'km', xpReward: 200, emoji: '🚴' },

  // Learning
  { id: 't5', title: 'Reading Club', description: 'Read chapters collectively', category: 'learning', suggestedTarget: 20, unit: 'chapters', xpReward: 150, emoji: '📚' },
  { id: 't6', title: 'Study Hours', description: 'Log your study or learning time', category: 'learning', suggestedTarget: 30, unit: 'hours', xpReward: 200, emoji: '🎓' },
  { id: 't7', title: 'Language Practice', description: 'Practice a new language daily', category: 'learning', suggestedTarget: 150, unit: 'minutes', xpReward: 175, emoji: '🌍' },

  // Art
  { id: 't8', title: 'Creative Streak', description: 'Create art every day', category: 'art', suggestedTarget: 7, unit: 'days', xpReward: 200, emoji: '🎨' },
  { id: 't9', title: 'Sketch Challenge', description: 'Complete sketches together', category: 'art', suggestedTarget: 15, unit: 'sketches', xpReward: 150, emoji: '✏️' },

  // Music
  { id: 't10', title: 'Practice Sessions', description: 'Log instrument practice', category: 'music', suggestedTarget: 300, unit: 'minutes', xpReward: 200, emoji: '🎸' },
  { id: 't11', title: 'Songs Learned', description: 'Learn new songs collectively', category: 'music', suggestedTarget: 10, unit: 'songs', xpReward: 175, emoji: '🎵' },

  // Wellness
  { id: 't12', title: 'Meditation Minutes', description: 'Mindfulness as a group', category: 'wellness', suggestedTarget: 200, unit: 'minutes', xpReward: 150, emoji: '🧘' },
  { id: 't13', title: 'Sleep Well', description: 'Log good sleep nights', category: 'wellness', suggestedTarget: 14, unit: 'nights', xpReward: 125, emoji: '😴' },
  { id: 't14', title: 'Hydration Quest', description: 'Drink 8 glasses a day', category: 'wellness', suggestedTarget: 56, unit: 'glasses', xpReward: 100, emoji: '💧' },

  // Social
  { id: 't15', title: 'Acts of Kindness', description: 'Do good things together', category: 'social', suggestedTarget: 20, unit: 'acts', xpReward: 200, emoji: '❤️' },
  { id: 't16', title: 'Cook Together', description: 'Log home-cooked meals', category: 'social', suggestedTarget: 14, unit: 'meals', xpReward: 125, emoji: '🍳' },
];

export const CATEGORY_LABELS: Record<string, string> = {
  exercise: 'Exercise',
  learning: 'Learning',
  art: 'Art',
  music: 'Music',
  wellness: 'Wellness',
  social: 'Social',
  custom: 'Custom',
};

export const CATEGORY_COLORS: Record<string, string> = {
  exercise: 'bg-orange-100 text-orange-700',
  learning: 'bg-blue-100 text-blue-700',
  art: 'bg-purple-100 text-purple-700',
  music: 'bg-pink-100 text-pink-700',
  wellness: 'bg-green-100 text-green-700',
  social: 'bg-yellow-100 text-yellow-700',
  custom: 'bg-gray-100 text-gray-700',
};
