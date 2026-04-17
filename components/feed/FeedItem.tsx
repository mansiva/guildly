'use client';

import { useState, useRef } from 'react';
import { ActivityEntry } from '@/types';
import { formatRelativeTime } from '@/lib/utils';
import UserAvatar from '@/components/ui/UserAvatar';
import { db } from '@/lib/firebase';
import { doc, updateDoc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
import { writeNotification } from '@/lib/notifications';

const FIXED_EMOJIS = ['🔥', '💪', '🎉', '⚡', '👏', '❤️'];

interface MemberProfile {
  uid: string;
  displayName: string;
  photoURL?: string;
  xp: number;
}

interface QuestRef {
  id: string;
  title: string;
  unit?: string;
}

interface Props {
  entry: ActivityEntry;
  members?: MemberProfile[];
  quests?: QuestRef[];
  groupId?: string;
  groupName?: string;
  currentUserId?: string;
}

export default function FeedItem({ entry, members, quests, groupId, groupName, currentUserId }: Props) {
  const [reactions, setReactions] = useState<Record<string, string[]>>(entry.reactions ?? {});
  const [showPicker, setShowPicker] = useState(false);
  const emojiInputRef = useRef<HTMLInputElement>(null);

  const time = entry.createdAt instanceof Date
    ? entry.createdAt
    : new Date((entry.createdAt as { seconds: number }).seconds * 1000);

  const member = members?.find(m => m.uid === entry.userId);
  const quest = quests?.find(q => q.id === entry.questId);

  const displayName = member?.displayName ?? 'Someone';
  const photoURL = member?.photoURL;
  const xp = member?.xp;
  const questTitle = quest?.title ?? '—';

  async function toggleReaction(emoji: string) {
    if (!currentUserId || !groupId) return;
    const feedRef = doc(db, 'groups', groupId, 'feed', entry.id);
    const key = `reactions.${emoji}`;
    const hasReacted = reactions[emoji]?.includes(currentUserId);

    // Optimistic update
    setReactions(prev => {
      const uids = prev[emoji] ?? [];
      if (hasReacted) return { ...prev, [emoji]: uids.filter(u => u !== currentUserId) };
      return { ...prev, [emoji]: [...uids, currentUserId] };
    });

    try {
      if (hasReacted) {
        await updateDoc(feedRef, { [key]: arrayRemove(currentUserId) });
      } else {
        await updateDoc(feedRef, { [key]: arrayUnion(currentUserId) });
        // Notify the feed entry author (not yourself)
        if (entry.userId !== currentUserId) {
          const me = members?.find(m => m.uid === currentUserId);
          await writeNotification(entry.userId, {
            type: 'reaction',
            fromUid: currentUserId,
            fromName: me?.displayName ?? 'Someone',
            emoji,
            feedEntryId: entry.id,
            questTitle: quest?.title,
            groupId,
            groupName,
          });
        }
      }
    } catch (e) {
      // Revert optimistic update on error
      setReactions(entry.reactions ?? {});
      console.error('[Reaction] Failed:', e);
    }
  }

  async function handleCustomEmoji(emoji: string) {
    if (!emoji || emoji.length === 0) return;
    // Take first emoji-like char
    const chars = [...emoji];
    const picked = chars[0];
    if (picked) await toggleReaction(picked);
    setShowPicker(false);
  }

  // Aggregate: only show emojis with at least 1 reaction
  const activeEmojis = Object.entries(reactions).filter(([, uids]) => uids.length > 0);

  // System messages
  if (entry.userId === 'system') {
    return (
      <div className="py-3 text-center">
        <p className="text-xs text-indigo-500 italic">{entry.nudge}</p>
      </div>
    );
  }

  // Badge earned entries
  if (entry.type === 'badge') {
    return (
      <div className="flex items-start gap-3 py-3">
        <UserAvatar photoURL={photoURL} displayName={displayName} xp={xp} size="sm" showLevel={false} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1 flex-wrap">
            <span className="font-semibold text-sm text-gray-900">{displayName}</span>
            <span className="text-sm text-gray-500">got a badge —</span>
            <span className="text-sm text-indigo-600 font-medium">{entry.nudge}</span>
          </div>
          <span className="text-xs text-gray-400">{formatRelativeTime(time)}</span>
          <ReactionBar
            activeEmojis={activeEmojis}
            reactions={reactions}
            currentUserId={currentUserId}
            onToggle={toggleReaction}
            onCustom={handleCustomEmoji}
            showPicker={showPicker}
            setShowPicker={setShowPicker}
            emojiInputRef={emojiInputRef}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 py-3">
      <UserAvatar photoURL={photoURL} displayName={displayName} xp={xp} size="sm" showLevel={false} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1 flex-wrap">
          <span className="font-semibold text-sm text-gray-900">{displayName}</span>
          <span className="text-sm text-gray-500">logged</span>
          <span className="font-semibold text-sm text-indigo-600">{entry.value} {quest?.unit}</span>
          <span className="text-sm text-gray-500">on</span>
          <span className="font-semibold text-sm text-gray-700">{questTitle}</span>
        </div>
        {entry.nudge && (
          <p className="text-xs text-indigo-500 mt-0.5 italic">{entry.nudge}</p>
        )}
        <span className="text-xs text-gray-400">{formatRelativeTime(time)}</span>
        <ReactionBar
          activeEmojis={activeEmojis}
          reactions={reactions}
          currentUserId={currentUserId}
          onToggle={toggleReaction}
          onCustom={handleCustomEmoji}
          showPicker={showPicker}
          setShowPicker={setShowPicker}
          emojiInputRef={emojiInputRef}
        />
      </div>
    </div>
  );
}

interface ReactionBarProps {
  activeEmojis: [string, string[]][];
  reactions: Record<string, string[]>;
  currentUserId?: string;
  onToggle: (emoji: string) => void;
  onCustom: (emoji: string) => void;
  showPicker: boolean;
  setShowPicker: (v: boolean) => void;
  emojiInputRef: React.RefObject<HTMLInputElement | null>;
}

function ReactionBar({ activeEmojis, reactions, currentUserId, onToggle, onCustom, showPicker, setShowPicker, emojiInputRef }: ReactionBarProps) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {/* Active reaction pills */}
      {activeEmojis.map(([emoji, uids]) => {
        const isMine = currentUserId ? uids.includes(currentUserId) : false;
        return (
          <button
            key={emoji}
            onClick={() => onToggle(emoji)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-all ${
              isMine
                ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                : 'bg-gray-100 text-gray-600 border border-gray-200'
            }`}
          >
            <span>{emoji}</span>
            <span>{uids.length}</span>
          </button>
        );
      })}

      {/* Fixed emoji quick-add buttons (only show if not yet reacted with that emoji) */}
      {FIXED_EMOJIS.filter(e => !reactions[e] || reactions[e].length === 0).slice(0, activeEmojis.length > 0 ? 0 : 6).map(emoji => (
        <button
          key={emoji}
          onClick={() => onToggle(emoji)}
          className="flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-50 text-gray-400 border border-gray-200 hover:bg-gray-100 transition-all"
        >
          {emoji}
        </button>
      ))}

      {/* + button for custom emoji */}
      <div className="relative">
        <button
          onClick={() => {
            setShowPicker(!showPicker);
            setTimeout(() => emojiInputRef.current?.focus(), 50);
          }}
          className="flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-50 text-gray-400 border border-gray-200 hover:bg-gray-100 transition-all"
        >
          {activeEmojis.length === 0 ? '＋' : '＋'}
        </button>
        {showPicker && (
          <div className="absolute bottom-8 left-0 z-10 bg-white border border-gray-200 rounded-2xl shadow-lg p-2 min-w-[200px]">
            <p className="text-xs text-gray-500 mb-2 px-1">Quick pick</p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {FIXED_EMOJIS.map(e => (
                <button key={e} onClick={() => onCustom(e)}
                  className="text-lg p-1 hover:bg-gray-100 rounded-lg transition-all">
                  {e}
                </button>
              ))}
            </div>
            <div className="border-t border-gray-100 pt-2">
              <input
                ref={emojiInputRef}
                type="text"
                placeholder="Type or paste emoji…"
                className="w-full text-sm px-2 py-1.5 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-indigo-200"
                onChange={e => {
                  const val = e.target.value;
                  if (val) { onCustom(val); e.target.value = ''; }
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
