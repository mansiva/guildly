import { ActivityEntry } from '@/types';
import { formatRelativeTime } from '@/lib/utils';
import UserAvatar from '@/components/ui/UserAvatar';

interface MemberProfile {
  uid: string;
  displayName: string;
  photoURL?: string;
  xp: number;
}

interface QuestRef {
  id: string;
  title: string;
}

interface Props {
  entry: ActivityEntry;
  members?: MemberProfile[];
  quests?: QuestRef[];
}

export default function FeedItem({ entry, members, quests }: Props) {
  const time = entry.createdAt instanceof Date
    ? entry.createdAt
    : new Date((entry.createdAt as { seconds: number }).seconds * 1000);

  // Live lookup — fall back to stored snapshot if member/quest not in list
  const member = members?.find(m => m.uid === entry.userId);
  const quest = quests?.find(q => q.id === entry.questId);

  const displayName = member?.displayName ?? entry.userName;
  const photoURL = member?.photoURL;
  const xp = member?.xp;
  const questTitle = quest?.title ?? entry.questTitle;

  // System messages (userId === 'system')
  if (entry.userId === 'system') {
    return (
      <div className="py-3 text-center">
        <p className="text-xs text-indigo-500 italic">{entry.nudge}</p>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 py-3">
      <UserAvatar
        photoURL={photoURL}
        displayName={displayName}
        xp={xp}
        size="sm"
        showLevel={false}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1 flex-wrap">
          <span className="font-semibold text-sm text-gray-900">{displayName}</span>
          <span className="text-sm text-gray-500">logged</span>
          <span className="font-semibold text-sm text-indigo-600">{entry.value} {entry.unit}</span>
          <span className="text-sm text-gray-500">on</span>
          <span className="font-semibold text-sm text-gray-700">{questTitle}</span>
        </div>
        {entry.nudge && (
          <p className="text-xs text-indigo-500 mt-0.5 italic">{entry.nudge}</p>
        )}
        <span className="text-xs text-gray-400">{formatRelativeTime(time)}</span>
      </div>
    </div>
  );
}
