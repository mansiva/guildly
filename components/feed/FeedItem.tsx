import { ActivityEntry } from '@/types';
import { formatRelativeTime } from '@/lib/utils';
import UserAvatar from '@/components/ui/UserAvatar';

export default function FeedItem({ entry }: { entry: ActivityEntry }) {
  const time = entry.createdAt instanceof Date
    ? entry.createdAt
    : new Date((entry.createdAt as { seconds: number }).seconds * 1000);

  return (
    <div className="flex items-start gap-3 py-3">
      <UserAvatar
        photoURL={entry.userPhoto}
        displayName={entry.userName}
        size="sm"
        showLevel={false}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1 flex-wrap">
          <span className="font-semibold text-sm text-gray-900">{entry.userName}</span>
          <span className="text-sm text-gray-500">logged</span>
          <span className="font-semibold text-sm text-indigo-600">{entry.value} {entry.unit}</span>
          <span className="text-sm text-gray-500">on</span>
          <span className="font-semibold text-sm text-gray-700">{entry.questTitle}</span>
        </div>
        {entry.nudge && (
          <p className="text-xs text-indigo-500 mt-0.5 italic">{entry.nudge}</p>
        )}
        <span className="text-xs text-gray-400">{formatRelativeTime(time)}</span>
      </div>
    </div>
  );
}
