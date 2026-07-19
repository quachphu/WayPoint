import { auth, stream } from '@mindstudio-ai/agent';
import { Users } from './tables/users';
import { Trips } from './tables/trips';
import { Messages } from './tables/messages';
import { extractTripMeta, createTripForUser } from './common/trips';
import { assertTripAccess, requestedByFor } from './common/collaborators';
import { runConversation } from './common/agent';

// The single entry point for both voice and chat. Streams status, board diffs,
// gate events (onStreamData), and the reply tokens (onToken). Proposes only —
// never books or calls.
export async function converse(input: {
  tripId?: string;
  text: string;
  source?: 'voice' | 'chat';
  focusNodeId?: string | null;
}) {
  const userId = auth.userId;
  if (!userId) throw new Error('Please sign in to plan a trip.');
  const user = await Users.get(userId);
  if (!user) throw new Error('Account not found.');

  const source = input.source === 'voice' ? 'voice' : 'chat';
  const text = (input.text || '').trim();
  if (!text) throw new Error('Say something and I will get started.');

  let trip;
  let created = false;
  // When a companion asks, actions they trigger are stamped with who requested
  // them; the owner's own turns carry no chip.
  let requestedBy = null;
  let authorName: string | undefined;
  let authorColor: string | undefined;
  if (input.tripId) {
    const access = await assertTripAccess(input.tripId, userId);
    trip = access.trip;
    requestedBy = await requestedByFor(access, userId);
    if (requestedBy) {
      authorName = requestedBy.name;
      authorColor = requestedBy.color;
    }
  } else {
    const meta = await extractTripMeta(text);
    trip = await createTripForUser(userId, meta);
    created = true;
    await stream({ type: 'trip_created', trip });
  }

  // Load the prior conversation BEFORE recording this turn, so the orchestrator
  // has real memory of the back-and-forth (origin/dates/travelers it already
  // asked about), not just the current sentence plus a board snapshot. The last
  // dozen turns is plenty of context without bloating the prompt.
  const priorMessages = created
    ? []
    : (await Messages.filter((m: Message) => m.tripId === trip.id))
        .filter((m) => (m.role === 'user' || m.role === 'agent') && !!m.text)
        .sort((a, b) => (a.created_at ?? 0) - (b.created_at ?? 0))
        .slice(-12)
        .map((m) => ({ role: m.role as 'user' | 'agent', text: m.text }));

  // Stamp the author on the message so shared conversations attribute companions.
  await Messages.push({
    tripId: trip.id,
    role: 'user',
    text,
    source,
    status: 'complete',
    authorId: userId,
    authorName,
    authorColor,
  });

  const { reply } = await runConversation({
    trip,
    user,
    userText: text,
    source,
    focusNodeId: input.focusNodeId,
    requestedBy,
    priorMessages,
  });

  await Messages.push({ tripId: trip.id, role: 'agent', text: reply, source: 'chat', status: 'complete' });

  const finalTrip = await Trips.get(trip.id);
  return { tripId: trip.id, created, reply, version: finalTrip?.version ?? 0, trip: finalTrip };
}
