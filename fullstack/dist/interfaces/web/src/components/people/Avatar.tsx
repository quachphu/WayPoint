import type { RosterMember } from '../../lib/types';
import { initials, presenceVar } from '../../lib/presence';

// A presence avatar: initials on the member's presence color, with an optional
// live halo (the animated pulse that means "here now"). Identity (the filled
// circle) is static; only the halo animates. Pending invites (no color) render
// as a neutral placeholder.
export function Avatar({
  member,
  size = 32,
  present = false,
  ring = true,
}: {
  member: Pick<RosterMember, 'displayName' | 'email' | 'presenceColor' | 'status'>;
  size?: number;
  present?: boolean;
  ring?: boolean;
}) {
  const pending = member.status === 'invited' || !member.presenceColor;
  const fontSize = Math.round(size * 0.38);
  const color = presenceVar(member.presenceColor);

  if (pending) {
    return (
      <span
        className="wp-avatar wp-avatar-pending"
        style={{ width: size, height: size, fontSize, boxShadow: ring ? '0 0 0 2px var(--surface-0)' : 'none' }}
        aria-hidden
      >
        ?
      </span>
    );
  }

  return (
    <span
      className="wp-avatar"
      style={{
        width: size,
        height: size,
        fontSize,
        background: color,
        boxShadow: ring ? '0 0 0 2px var(--surface-0)' : 'none',
      }}
    >
      {present && <span className="wp-avatar-halo" style={{ color }} />}
      <span className="wp-avatar-initials">{initials(member)}</span>
    </span>
  );
}
