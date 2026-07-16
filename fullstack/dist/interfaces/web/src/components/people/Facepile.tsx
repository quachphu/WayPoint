import { useStore, isPresent } from '../../lib/store';
import { Avatar } from './Avatar';
import { IconUsers, IconPlus } from '../icons';
import type { RosterMember } from '../../lib/types';

// Title-bar sharing control. Solo (just me) → a "Share" pill. Shared → the
// facepile (owner first, then most-recently-active), overflowing to +N, with a
// trailing "+" ghost circle. Either opens the People panel.
export function Facepile() {
  const roster = useStore((s) => s.roster);
  const openPeople = useStore((s) => s.openPeople);
  const peopleOpen = useStore((s) => s.peopleOpen);

  // Only real people (owner + companions) count for the pile; pending invites
  // are shown inside the panel, not on the facepile.
  const people = roster.filter((m) => m.status === 'active');
  const others = people.filter((m) => !m.isYou).length;

  if (people.length <= 1 && others === 0) {
    return (
      <button className={`wp-share-pill ${peopleOpen ? 'is-active' : ''}`} onClick={openPeople} title="Share this trip">
        <IconUsers size={15} stroke={1.7} />
        <span>Share</span>
      </button>
    );
  }

  const ordered = orderForPile(people);
  const shown = ordered.slice(0, 4);
  const extra = ordered.length - shown.length;

  return (
    <button className={`wp-facepile ${peopleOpen ? 'is-active' : ''}`} onClick={openPeople} title="People on this trip">
      <span className="wp-facepile-avatars">
        {shown.map((m) => (
          <span className="wp-facepile-slot" key={m.id}>
            <Avatar member={m} size={24} present={isPresent(m)} />
          </span>
        ))}
        {extra > 0 && <span className="wp-facepile-more">+{extra}</span>}
      </span>
      <span className="wp-facepile-add" aria-hidden>
        <IconPlus size={13} stroke={2} />
      </span>
    </button>
  );
}

function orderForPile(people: RosterMember[]): RosterMember[] {
  return [...people].sort((a, b) => {
    if (a.role === 'owner') return -1;
    if (b.role === 'owner') return 1;
    return (b.lastSeenAt || 0) - (a.lastSeenAt || 0);
  });
}
