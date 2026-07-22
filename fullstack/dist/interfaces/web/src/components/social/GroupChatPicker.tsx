import { useState } from 'react';
import { useStore } from '../../lib/store';
import { avatarForUser } from '../../lib/onboardingOptions';
import { IconArrowLeft } from '../icons';

function friendlyName(u: { displayName: string | null }): string {
  return u.displayName || 'A fellow traveler';
}

// A dedicated full-screen picker for starting a group chat — the same
// fixed-inset-0 + back-button-header treatment ConversationScreen already
// uses in this file, so "another screen" is a pattern this app already has,
// not a new one. Sourced from ALL of your friends (listFriends), not just
// whoever happens to be in the current People-nearby location scope.
export function GroupChatPicker() {
  const friends = useStore((s) => s.friends);
  const closeGroupPicker = useStore((s) => s.closeGroupPicker);
  const openConversationWith = useStore((s) => s.openConversationWith);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [starting, setStarting] = useState(false);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const start = async () => {
    if (selected.size < 2 || starting) return;
    setStarting(true);
    await openConversationWith([...selected]);
    setStarting(false);
    closeGroupPicker();
  };

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: 'var(--canvas)', zIndex: 999500 }}>
      <div className="flex items-center gap-3 border-b border-[var(--border-warm)] px-5 py-4" style={{ background: 'var(--surface)' }}>
        <button className="icon-btn shrink-0" onClick={closeGroupPicker} aria-label="Back to chats">
          <IconArrowLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="font-display truncate text-base font-semibold text-[var(--text)]">New group chat</div>
          <div className="font-space truncate text-xs text-[var(--text-3)]">Pick 2 or more friends</div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[520px] flex-1 flex-col overflow-y-auto px-5 py-4">
        {friends.length === 0 ? (
          <p className="font-space p-4 text-sm text-[var(--text-3)]">
            You don't have any friends yet — add someone from People nearby first.
          </p>
        ) : (
          friends.map((f) => (
            <label
              key={f.id}
              className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 transition-colors duration-150 hover:bg-[var(--surface-2)]"
            >
              <input
                type="checkbox"
                checked={selected.has(f.id)}
                onChange={() => toggle(f.id)}
                className="h-4 w-4 shrink-0 accent-[var(--live)]"
                aria-label={`Select ${friendlyName(f)}`}
              />
              <img
                src={avatarForUser(f)}
                alt=""
                className="h-9 w-9 shrink-0 rounded-full object-cover"
                style={{ background: 'var(--surface-2)' }}
              />
              <span className="font-space truncate text-sm font-medium text-[var(--text)]">{friendlyName(f)}</span>
            </label>
          ))
        )}
      </div>

      <div className="mx-auto w-full max-w-[520px] px-5 py-4">
        <button
          onClick={start}
          disabled={selected.size < 2 || starting}
          className="font-display w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-50"
          style={{ background: 'var(--live)' }}
        >
          {starting ? 'Starting…' : `Start group chat (${selected.size})`}
        </button>
      </div>
    </div>
  );
}
