import type { RosterMember } from './types';

// The server stores each person's light-mode palette hex. Map it back to the
// themed CSS variable so dark mode lifts/trims automatically (and every viewer
// still agrees on which person is which color). Unknown values pass through.
const PRESENCE_HEX = ['#0fa697', '#6e56cf', '#e0457e', '#5a9e3d', '#b24ac9', '#2196c9'];
export function presenceVar(hex?: string | null): string {
  if (!hex) return 'var(--text-secondary)';
  const i = PRESENCE_HEX.indexOf(hex.toLowerCase());
  return i >= 0 ? `var(--presence-${i + 1})` : hex;
}

// Initials for an avatar: first letter of first + last name, else first letter
// of the email. Uppercase. One name → one letter.
export function initials(member: Pick<RosterMember, 'displayName' | 'email'>): string {
  const name = (member.displayName || '').trim();
  if (name) {
    const parts = name.split(/\s+/);
    if (parts.length === 1) return parts[0][0]!.toUpperCase();
    return (parts[0][0]! + parts[parts.length - 1][0]!).toUpperCase();
  }
  const email = (member.email || '').trim();
  return email ? email[0]!.toUpperCase() : '?';
}

// A short display label for a member ("You", a name, or the email for a pending
// invite).
export function memberLabel(member: RosterMember): string {
  if (member.isYou) return 'You';
  return member.displayName || member.email || 'Someone';
}

// A first-name-ish handle for inline copy ("Waiting for Maya").
export function shortName(member: RosterMember | null | undefined, fallback = 'the owner'): string {
  if (!member) return fallback;
  if (member.displayName) return member.displayName.split(/\s+/)[0];
  if (member.email) return member.email.split('@')[0];
  return fallback;
}

// Relative "active Nm ago" label for a member's last-seen time.
export function lastSeenLabel(lastSeenAt: number | null): string {
  if (!lastSeenAt) return '';
  const diff = Date.now() - lastSeenAt;
  if (diff < 60_000) return 'Active just now';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `Active ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Active ${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `Active ${days}d ago`;
}
