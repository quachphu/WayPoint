import { useEffect, useState } from 'react';
import { useStore } from '../../lib/store';
import { IconCheck, IconHourglassLow, IconMapPin, IconMessage2, IconUserPlus, IconUsers, IconX } from '../icons';
import { avatarForUser } from '../../lib/onboardingOptions';
import type { LocationScope, NearbyUser } from '../../lib/types';

const SCOPES: { value: LocationScope; label: string }[] = [
  { value: 'city', label: 'City' },
  { value: 'region', label: 'State' },
  { value: 'country', label: 'Country' },
];

function friendlyName(u: { displayName: string | null }): string {
  return u.displayName || 'A fellow traveler';
}

// City + region is enough context in a narrow sidebar; country rarely adds
// anything (and pushed the line into an awkward mid-word truncation).
function locationLine(u: NearbyUser): string {
  return [u.city, u.region].filter(Boolean).join(', ') || u.country || '';
}

export function PeopleNearby() {
  const scope = useStore((s) => s.nearbyScope);
  const setScope = useStore((s) => s.setNearbyScope);
  const loadNearby = useStore((s) => s.loadNearby);
  const users = useStore((s) => s.nearbyUsers);
  const loading = useStore((s) => s.nearbyLoading);
  const hasLocation = useStore((s) => s.nearbyHasLocation);
  const openConversationWith = useStore((s) => s.openConversationWith);
  const friendRequests = useStore((s) => s.friendRequests);
  const loadFriendRequests = useStore((s) => s.loadFriendRequests);
  const sendFriendRequest = useStore((s) => s.sendFriendRequest);
  const respondToFriendRequest = useStore((s) => s.respondToFriendRequest);

  useEffect(() => {
    loadNearby();
    loadFriendRequests();
    // Neither call is polled anywhere else, so without this a pending
    // request you sent stays stuck on "Sent" until something unrelated
    // (a reload, a scope-tab click) happens to refetch — the other
    // person accepting never pushes anything to your client on its own.
    const tick = () => {
      if (!document.hidden) {
        loadNearby();
        loadFriendRequests();
      }
    };
    const id = window.setInterval(tick, 15000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="rounded-2xl border border-[var(--border-warm)] p-5" style={{ background: 'var(--surface)' }}>
      <div className="mb-4 flex items-center gap-2">
        <IconUsers size={18} style={{ color: 'var(--live)' }} />
        <span className="font-display text-sm font-semibold text-[var(--text)]">People nearby</span>
      </div>

      {/* Incoming friend requests can come from outside the current scope, so
          this is its own section, not filtered by the city/state/country toggle. */}
      {friendRequests.length > 0 && (
        <div className="mb-4 flex flex-col gap-1 rounded-lg border border-[var(--border-warm)] p-2" style={{ background: 'var(--surface-2)' }}>
          <div className="font-space mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
            Friend requests
          </div>
          {friendRequests.map((r) => (
            <div key={r.id} className="flex items-center gap-2.5 rounded-lg px-1 py-1.5">
              <img src={avatarForUser(r)} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" style={{ background: 'var(--surface)' }} />
              <span className="font-space min-w-0 flex-1 truncate text-sm font-medium text-[var(--text)]">{friendlyName(r)}</span>
              <button
                onClick={() => respondToFriendRequest(r.id, true)}
                className="icon-btn shrink-0"
                aria-label={`Accept ${friendlyName(r)}`}
                title="Accept"
                style={{ color: 'var(--live)' }}
              >
                <IconCheck size={16} />
              </button>
              <button
                onClick={() => respondToFriendRequest(r.id, false)}
                className="icon-btn shrink-0"
                aria-label={`Decline ${friendlyName(r)}`}
                title="Decline"
              >
                <IconX size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mb-4 flex rounded-lg bg-[var(--surface-2)] p-1">
        {SCOPES.map((s) => (
          <button
            key={s.value}
            onClick={() => setScope(s.value)}
            className="font-space flex-1 rounded-md py-1.5 text-xs font-medium transition-[color,background-color,transform] duration-150 ease-out active:scale-[0.96]"
            style={
              scope === s.value
                ? { background: 'var(--live)', color: 'var(--on-accent)' }
                : { color: 'var(--text-2)' }
            }
          >
            {s.label}
          </button>
        ))}
      </div>

      {!hasLocation && !loading && (
        <p className="font-space text-xs text-[var(--text-3)]">
          Turn on location access to see travelers near you.
        </p>
      )}
      {hasLocation && !loading && users.length === 0 && (
        <p className="font-space text-xs text-[var(--text-3)]">No one signed up from here yet — be the first to invite a friend.</p>
      )}

      <div className="flex flex-col gap-1">
        {users.map((u) => {
          return (
            <div key={u.id} className="flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors duration-150 hover:bg-[var(--surface-2)]">
              <img
                src={avatarForUser(u)}
                alt=""
                className="h-9 w-9 shrink-0 rounded-full object-cover"
                style={{ background: 'var(--surface-2)' }}
              />
              <div className="min-w-0 flex-1">
                <div className="font-space flex items-center gap-1.5 truncate text-sm font-medium text-[var(--text)]">
                  <span className="truncate">{friendlyName(u)}</span>
                  {u.age != null && <span className="shrink-0 text-[var(--text-3)]">· {u.age}</span>}
                  {u.isBirthdayToday && (
                    <span className="shrink-0" title="It's their birthday today!">
                      🎂
                    </span>
                  )}
                </div>
                <div className="font-space flex items-center gap-1 truncate text-xs text-[var(--text-3)]">
                  <IconMapPin size={11} />
                  {locationLine(u) || '—'}
                </div>
                {u.recommended && (
                  <span
                    className="font-space mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{ background: 'color-mix(in oklch, var(--live) 18%, transparent)', color: 'var(--live)' }}
                    title={`${u.sharedInterestCount} things in common`}
                  >
                    Recommended
                  </span>
                )}
              </div>

              {u.friendStatus === 'friends' && (
                <button
                  onClick={() => openConversationWith([u.id])}
                  className="icon-btn shrink-0"
                  aria-label={`Message ${friendlyName(u)}`}
                  title="Message"
                >
                  <IconMessage2 size={16} />
                </button>
              )}
              {u.friendStatus === 'none' && (
                <button
                  onClick={() => sendFriendRequest(u.id)}
                  className="icon-btn shrink-0"
                  aria-label={`Add ${friendlyName(u)} as a friend`}
                  title="Add friend"
                  style={{ color: 'var(--live)' }}
                >
                  <IconUserPlus size={16} />
                </button>
              )}
              {u.friendStatus === 'pending_outgoing' && (
                <span className="font-space flex shrink-0 items-center gap-1 px-1 text-[11px] text-[var(--text-3)]" title="Waiting for them to accept">
                  <IconHourglassLow size={14} />
                  Sent
                </span>
              )}
              {u.friendStatus === 'pending_incoming' && u.friendRequestId && (
                <button
                  onClick={() => respondToFriendRequest(u.friendRequestId!, true)}
                  className="font-space shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                  style={{ background: 'var(--live)', color: 'var(--on-accent)' }}
                >
                  Accept
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
