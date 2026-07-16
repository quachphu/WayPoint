import { auth } from '@mindstudio-ai/agent';
import { TripCollaborators } from './tables/tripCollaborators';
import { PRESENCE_PALETTE, buildRoster } from './common/collaborators';
import { getTripBundle } from './common/trips';

// Attach the current user to a trip via an invite token (the link they
// followed). Works even if they signed in with a different email than was
// invited. Idempotent: following the link again just returns the trip.
export async function claimInvite(input: { inviteToken: string }) {
  const userId = auth.userId;
  if (!userId) throw new Error('Please sign in to join this trip.');
  const token = (input.inviteToken || '').trim();
  if (!token) throw new Error('That invite link is missing its code.');

  const matches = await TripCollaborators.filter(
    (c, $) => c.inviteToken === $.token,
    { token }, // bindings: lifts closure var so filter compiles to SQL
  );
  const row = matches[0];
  if (!row) throw new Error('That invite link is no longer valid.');

  // If already claimed by someone else, only that user may re-use it.
  if (row.userId && row.userId !== userId) {
    throw new Error('That invite has already been used by someone else.');
  }

  if (!row.userId) {
    // Assign the next presence color by the count already assigned on this trip.
    const members = await TripCollaborators.filter(
      (c, $) => c.tripId === $.tripId,
      { tripId: row.tripId }, // bindings: lifts closure var so filter compiles to SQL
    );
    const assigned = members.filter((m) => !!m.presenceColor).length;
    const color = PRESENCE_PALETTE[assigned % PRESENCE_PALETTE.length];
    await TripCollaborators.update(row.id, { userId, status: 'active', presenceColor: color });
  }

  const bundle = await getTripBundle(row.tripId);
  const roster = await buildRoster(row.tripId, userId);
  return { ok: true, tripId: row.tripId, ...bundle, roster };
}
