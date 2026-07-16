import { auth } from '@mindstudio-ai/agent';
import { TripCollaborators } from './tables/tripCollaborators';
import { assertTripAccess, buildRoster } from './common/collaborators';

// Owner promotes/demotes a companion's approval rights (may they clear a
// confirm-gate?). Owner-only. The owner's own row is never changed here.
export async function setApproval(input: { tripId: string; collaboratorId: string; canApprove: boolean }) {
  const userId = auth.userId;
  if (!userId) throw new Error('Please sign in.');

  const access = await assertTripAccess(input.tripId, userId);
  if (!access.isOwner) throw new Error('Only the trip owner can change who can approve.');

  const row = await TripCollaborators.get(input.collaboratorId);
  if (!row || row.tripId !== input.tripId) throw new Error('That person is not on this trip.');
  if (row.role === 'owner') throw new Error('The owner can always approve.');

  await TripCollaborators.update(row.id, { canApprove: !!input.canApprove });
  const roster = await buildRoster(input.tripId, userId);
  return { ok: true, roster };
}
