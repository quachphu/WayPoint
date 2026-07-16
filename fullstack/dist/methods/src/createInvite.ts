import { auth } from '@mindstudio-ai/agent';
import { Users } from './tables/users';
import { TripCollaborators } from './tables/tripCollaborators';
import { assertTripAccess, normalizeEmail, mintInviteToken, buildRoster } from './common/collaborators';

// Mint a companion invite. The backend does NOT send email/SMS itself (the
// platform blocks cold-sending to non-users, which also hurts deliverability):
// it returns a shareable invite path the owner delivers through their own
// channel (copy link, pre-filled mail, pre-filled text). Idempotent per email.
export async function createInvite(input: { tripId: string; email: string }) {
  const userId = auth.userId;
  if (!userId) throw new Error('Please sign in.');

  // Anyone on the trip may bring someone in.
  const access = await assertTripAccess(input.tripId, userId);
  const email = normalizeEmail(input.email);
  if (!email || !email.includes('@')) throw new Error('That does not look like an email address.');

  const inviter = await Users.get(userId);
  const invitedByName = inviter?.displayName || null;

  // Re-inviting the same email is idempotent: reuse the existing row + token.
  const existing = await TripCollaborators.filter(
    (c, $) => c.tripId === $.tripId && c.email === $.email,
    { tripId: input.tripId, email }, // bindings: lifts closure vars so filter compiles to SQL
  );

  let row;
  if (existing.length) {
    row = existing[0];
    // Ensure a token exists (older rows / owner rows won't have one).
    if (!row.inviteToken) {
      row = await TripCollaborators.update(row.id, { inviteToken: mintInviteToken(), invitedByName });
    }
  } else {
    row = await TripCollaborators.push({
      tripId: input.tripId,
      userId: null,
      email,
      role: 'companion',
      canApprove: false,
      presenceColor: '', // assigned on claim
      status: 'invited',
      invitedByName,
      inviteToken: mintInviteToken(),
      focusNodeId: null,
      lastSeenAt: null,
    });
  }

  const roster = await buildRoster(input.tripId, userId);
  return {
    ok: true,
    invitePath: `/join/${row.inviteToken}`,
    collaboratorId: row.id,
    email,
    tripTitle: access.trip.title,
    invitedByName,
    roster,
  };
}
