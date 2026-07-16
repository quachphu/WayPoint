import { db } from '@mindstudio-ai/agent';
import { randomUUID } from 'crypto';
import { Trips, type Trip } from '../tables/trips';
import { Users } from '../tables/users';
import { TripCollaborators, type TripCollaborator } from '../tables/tripCollaborators';
import type { RequestedBy } from './types';

// The fixed presence palette (see src/interfaces/@brand/visual.md). Assigned in
// join order, owner first, cycling past six. Stored on the row so every viewer
// sees the same color for the same person.
export const PRESENCE_PALETTE = [
  '#0FA697', // Jade — owner default
  '#6E56CF', // Violet
  '#E0457E', // Rose
  '#5A9E3D', // Fern
  '#B24AC9', // Plum
  '#2196C9', // Cerulean
];

// Email is matched lowercased + trimmed everywhere so Jordan@x.com === jordan@x.com.
export function normalizeEmail(email: string | null | undefined): string {
  return (email || '').trim().toLowerCase();
}

export function mintInviteToken(): string {
  return `${randomUUID()}${randomUUID()}`.replace(/-/g, '');
}

// The next color for a trip: the count of members that already hold a color,
// modulo the palette length. Owner (created first) lands on index 0 = Jade.
async function nextPresenceColor(tripId: string): Promise<string> {
  const members = await TripCollaborators.filter(
    (c, $) => c.tripId === $.tripId,
    { tripId }, // bindings: lifts closure var so filter compiles to SQL
  );
  const assigned = members.filter((m) => !!m.presenceColor).length;
  return PRESENCE_PALETTE[assigned % PRESENCE_PALETTE.length];
}

export interface TripAccess {
  trip: Trip & { id: string };
  collaborator: (TripCollaborator & { id: string }) | null;
  isOwner: boolean;
  canApprove: boolean;
}

// The single access check. A user may reach a trip if they own it (trip.userId)
// OR are an active collaborator on it. Throws the same "Trip not found." for a
// stranger so existence can't even be probed. Replaces the scattered
// `trip.userId !== userId` checks across the methods.
export async function assertTripAccess(tripId: string, userId: string): Promise<TripAccess> {
  const [trip, membership] = await db.batch(
    Trips.get(tripId),
    TripCollaborators.filter(
      (c, $) => c.tripId === $.tripId && c.userId === $.userId,
      { tripId, userId }, // bindings: lifts closure vars so filter compiles to SQL
    ),
  );
  if (!trip) throw new Error('Trip not found.');

  const collaborator = (membership.find((m) => m.status === 'active') as (TripCollaborator & { id: string }) | undefined) || null;
  const isOwner = trip.userId === userId || collaborator?.role === 'owner';

  // Owner is always allowed even if (for legacy trips) no owner row exists yet.
  if (!isOwner && !collaborator) throw new Error('Trip not found.');

  const canApprove = isOwner || !!collaborator?.canApprove;
  return { trip, collaborator, isOwner, canApprove };
}

// Ensure a trip has an owner collaborator row (idempotent). Called at trip
// creation and when a demo trip is claimed. Assigns the owner presence color.
export async function ensureOwnerRow(tripId: string, ownerUserId: string): Promise<void> {
  const existing = await TripCollaborators.filter(
    (c, $) => c.tripId === $.tripId && c.role === 'owner',
    { tripId }, // bindings: lifts closure var so filter compiles to SQL
  );
  if (existing.length) {
    // Keep the owner row's userId in sync if the trip was reassigned (demo claim).
    if (existing[0].userId !== ownerUserId) {
      await TripCollaborators.update(existing[0].id, { userId: ownerUserId, status: 'active' });
    }
    return;
  }
  const user = await Users.get(ownerUserId);
  const color = await nextPresenceColor(tripId);
  await TripCollaborators.push({
    tripId,
    userId: ownerUserId,
    email: normalizeEmail(user?.email),
    role: 'owner',
    canApprove: true,
    presenceColor: color,
    status: 'active',
    invitedByName: null,
    inviteToken: null,
    focusNodeId: null,
    lastSeenAt: null,
  });
}

// Claim any outstanding invites addressed to this user's email (the email-match
// fallback that runs on every bootstrap). Assigns each a presence color.
export async function claimInvitesByEmail(userId: string, email: string): Promise<number> {
  const normalized = normalizeEmail(email);
  if (!normalized) return 0;
  const matches = await TripCollaborators.filter(
    (c, $) => c.email === $.email && c.userId === null,
    { email: normalized }, // bindings: lifts closure var so filter compiles to SQL
  );
  let claimed = 0;
  for (const row of matches) {
    const color = row.presenceColor || (await nextPresenceColor(row.tripId));
    await TripCollaborators.update(row.id, { userId, status: 'active', presenceColor: color });
    claimed++;
  }
  return claimed;
}

// Every trip a user may see: ones they own, plus ones they're an active
// collaborator on. Deduped, newest first. Backs getBootstrap and listTrips.
export async function listAccessibleTrips(userId: string): Promise<(Trip & { id: string })[]> {
  const [owned, memberships] = await db.batch(
    Trips.filter((t, $) => t.userId === $.userId, { userId }), // bindings: lifts closure var so filter compiles to SQL
    TripCollaborators.filter(
      (c, $) => c.userId === $.userId && c.status === 'active',
      { userId }, // bindings: lifts closure var so filter compiles to SQL
    ),
  );
  const ownedIds = new Set(owned.map((t) => t.id));
  const extraIds = [...new Set(memberships.map((m) => m.tripId))].filter((id) => !ownedIds.has(id));
  const extra = extraIds.length ? await db.batch(...extraIds.map((id) => Trips.get(id))) : [];
  const all = [...owned, ...extra.filter(Boolean)] as (Trip & { id: string })[];
  // updated_at is a system column present on every row at runtime.
  return all.sort((a, b) => ((b as any).updated_at || 0) - ((a as any).updated_at || 0));
}

// The presence-color-and-name enriched roster the frontend renders. Batches the
// user lookups so names come along in one pass.
export interface RosterMember {
  id: string;
  userId: string | null;
  email: string;
  displayName: string | null;
  role: 'owner' | 'companion';
  canApprove: boolean;
  presenceColor: string;
  status: 'invited' | 'active';
  focusNodeId: string | null;
  lastSeenAt: number | null;
  isYou: boolean;
}

export async function buildRoster(tripId: string, currentUserId: string | null): Promise<RosterMember[]> {
  const rows = await TripCollaborators.filter(
    (c, $) => c.tripId === $.tripId,
    { tripId }, // bindings: lifts closure var so filter compiles to SQL
  );
  // Fetch display names for claimed members in one batch.
  const userIds = [...new Set(rows.map((r) => r.userId).filter((x): x is string => !!x))];
  const users = userIds.length ? await db.batch(...userIds.map((id) => Users.get(id))) : [];
  const nameById = new Map(users.filter(Boolean).map((u: any) => [u.id, u.displayName || null]));

  return rows
    .map((r) => ({
      id: r.id,
      userId: r.userId,
      email: r.email,
      displayName: r.userId ? nameById.get(r.userId) ?? null : null,
      role: r.role,
      canApprove: r.canApprove,
      presenceColor: r.presenceColor,
      status: r.status,
      focusNodeId: r.focusNodeId,
      lastSeenAt: r.lastSeenAt,
      isYou: !!currentUserId && r.userId === currentUserId,
    }))
    // Owner first, then active members, then pending invites.
    .sort((a, b) => rank(a) - rank(b));
}

function rank(m: RosterMember): number {
  if (m.role === 'owner') return 0;
  if (m.status === 'active') return 1;
  return 2;
}

// The requestedBy stamp for a companion-originated action. Null for the owner
// (no chip). Built from the caller's membership + profile.
export async function requestedByFor(access: TripAccess, userId: string): Promise<RequestedBy | null> {
  if (access.isOwner || !access.collaborator) return null;
  const user = await Users.get(userId);
  return {
    userId,
    name: user?.displayName || 'A companion',
    color: access.collaborator.presenceColor || PRESENCE_PALETTE[1],
  };
}

// The owner's display name, for the "waiting for [owner]" copy shown to companions.
export async function ownerNameFor(trip: Trip & { id: string }): Promise<string> {
  const owners = await TripCollaborators.filter(
    (c, $) => c.tripId === $.tripId && c.role === 'owner',
    { tripId: trip.id }, // bindings: lifts closure var so filter compiles to SQL
  );
  const ownerUserId = owners[0]?.userId || trip.userId;
  if (!ownerUserId) return 'the owner';
  const user = await Users.get(ownerUserId);
  return user?.displayName || 'the owner';
}
