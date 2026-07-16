import { auth } from '@mindstudio-ai/agent';
import { TripCollaborators } from './tables/tripCollaborators';
import { assertTripAccess, ensureOwnerRow, buildRoster } from './common/collaborators';
import { getTripBundle } from './common/trips';

// The live poll. One cheap call does three things: records the caller's own
// presence (which node they're looking at, active now), returns the fresh trip
// bundle ONLY if the trip changed since the caller last saw it, and always
// returns the roster with everyone's presence for the live markers. Called
// ~every 4s while a trip is open and the tab is focused.
export async function syncTrip(input: {
  tripId: string;
  sinceVersion?: number;
  focusNodeId?: string | null;
}) {
  const userId = auth.userId;
  if (!userId) throw new Error('Please sign in.');

  const access = await assertTripAccess(input.tripId, userId);

  // (1) Record this caller's presence heartbeat on their membership row.
  let collaborator = access.collaborator;
  if (!collaborator && access.isOwner) {
    // Legacy trip without an owner row yet — create it, then re-resolve.
    await ensureOwnerRow(input.tripId, userId);
    const rows = await TripCollaborators.filter(
      (c, $) => c.tripId === $.tripId && c.userId === $.userId,
      { tripId: input.tripId, userId }, // bindings: lifts closure vars so filter compiles to SQL
    );
    collaborator = (rows[0] as any) || null;
  }
  if (collaborator) {
    await TripCollaborators.update(collaborator.id, {
      focusNodeId: input.focusNodeId ?? null,
      lastSeenAt: Date.now(),
    });
  }

  // (2) Version gate: only ship the (larger) bundle when something changed.
  const version = access.trip.version || 0;
  const changed = version > (input.sinceVersion ?? -1);

  // (3) Always return the roster (small) for presence + people UI.
  const roster = await buildRoster(input.tripId, userId);

  if (!changed) {
    return { changed: false as const, version, roster };
  }

  const bundle = await getTripBundle(input.tripId);
  return {
    changed: true as const,
    version,
    roster,
    trip: bundle.trip,
    messages: bundle.messages,
    pendingActions: bundle.pendingActions,
    activeCall: bundle.activeCall,
  };
}
