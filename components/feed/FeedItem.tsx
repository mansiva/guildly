import { ActivityEntry } from '@/types';
import { formatRelativeTime } from '@/lib/utils';

export default function FeedItem({ entry }: { entry: ActivityEntry }) {
  const time = entry.createdAt instanceof Date
    ? entry.createdAt
    : new Date((entry.createdAt as { seconds: number }).seconds * 1000);

  return (
    <div className="flex items-start gap-3 py-3">
      <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-600 shrink-0">
        {entry.userPhoto
          ? <img src={entry.userPhoto} alt="" className="w-9 h-9 rounded-full object-cover" />
          : entry.userName?.[0]?.toUpperCase() || '?'}
      </div>
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
