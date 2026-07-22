import { auth } from '@mindstudio-ai/agent';
import { CallSessions } from './tables/callSessions';
import { assertTripAccess } from './common/collaborators';
import { missTravelerCall } from './common/travelerCall';

// Declining is not silent — it falls back to the exact same message the call
// would have delivered, posted to chat (see common/travelerCall.ts).
export async function declineTravelerCall(input: { callSessionId: string }) {
  const userId = auth.userId;
  if (!userId) throw new Error('Please sign in.');
  const call = await CallSessions.get(input.callSessionId);
  if (!call) throw new Error('Call not found.');
  await assertTripAccess(call.tripId, userId);
  await missTravelerCall(input.callSessionId, 'declined');
  return { ok: true };
}
