import { auth } from '@mindstudio-ai/agent';
import { Trips } from './tables/trips';
import { Messages } from './tables/messages';
import { runDisruption } from './common/disruption';
import { assertTripAccess } from './common/collaborators';

// The demo affordance (and the path a chat/voice "my flight got delayed" can
// also take). Marks the flight disrupted, re-shops, and raises the call gate,
// streaming board updates. Call with stream: true.
export async function reportDisruption(input: { tripId: string; nodeId?: string; description?: string }) {
  const userId = auth.userId;
  if (!userId) throw new Error('Please sign in.');
  // Anyone on the trip can flag a disruption (the call still gates on approval).
  await assertTripAccess(input.tripId, userId);

  const res = await runDisruption({
    tripId: input.tripId,
    nodeId: input.nodeId,
    description: input.description,
    actor: userId,
  });

  if (res.ok) {
    await Messages.push({ tripId: input.tripId, role: 'agent', text: res.message, source: 'system', status: 'complete' });
  }

  const finalTrip = await Trips.get(input.tripId);
  return { ok: res.ok, message: res.message, tripId: input.tripId, version: finalTrip?.version ?? 0, trip: finalTrip };
}
