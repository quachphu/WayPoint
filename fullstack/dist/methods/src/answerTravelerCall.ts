import { auth } from '@mindstudio-ai/agent';
import { CallSessions } from './tables/callSessions';
import { assertTripAccess } from './common/collaborators';
import { answerTravelerCall as answer } from './common/travelerCall';

// The traveler (or anyone with trip access, same as watching the airline
// call run) picks up a ringing "Waypoint Calls You" session.
export async function answerTravelerCall(input: { callSessionId: string }) {
  const userId = auth.userId;
  if (!userId) throw new Error('Please sign in.');
  const call = await CallSessions.get(input.callSessionId);
  if (!call) throw new Error('Call not found.');
  await assertTripAccess(call.tripId, userId);
  return answer(input.callSessionId);
}
