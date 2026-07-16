import { auth } from '@mindstudio-ai/agent';
import { getTripBundle } from './common/trips';
import { assertTripAccess, buildRoster } from './common/collaborators';

export async function getTrip(input: { tripId: string }) {
  const userId = auth.userId;
  if (!userId) throw new Error('Please sign in.');
  // Owner or active companion may load the trip; strangers get "not found".
  await assertTripAccess(input.tripId, userId);
  const bundle = await getTripBundle(input.tripId);
  const roster = await buildRoster(input.tripId, userId);
  return { ...bundle, roster };
}
