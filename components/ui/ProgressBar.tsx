import { cn } from '@/lib/utils';

interface ProgressBarProps {
  value: number;
  max: number;
  className?: string;
  color?: string;
  trackColor?: string;
  showLabel?: boolean;
}

export default function ProgressBar({ value, max, className, color = 'bg-indigo-500', trackColor = 'bg-gray-200', showLabel = false }: ProgressBarProps) {
  const pct = Math.min(100, Math.round((value / max) * 100));

  return (
    <div className={cn('w-full', className)}>
      <div className={cn('w-full rounded-full h-2 overflow-hidden', trackColor)}>
        <div
          className={cn('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{value.toLocaleString()} / {max.toLocaleString()}</span>
          <span>{pct}%</span>
        </div>
      )}
    </div>
  );
}
