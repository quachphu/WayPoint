import { auth, stream } from '@mindstudio-ai/agent';
import { Users } from './tables/users';
import { Trips } from './tables/trips';
import { Messages, type Message } from './tables/messages';
import { extractTripMeta, createTripForUser, funnifyTripName, isDifferentTripRequest } from './common/trips';
import { assertTripAccess, requestedByFor } from './common/collaborators';
import { setPendingVoiceConfirm, takePendingVoiceConfirm, isAffirmative } from './common/voiceConfirm';
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

  // A tripId being passed doesn't necessarily mean this turn is ABOUT that
  // trip — mid-conversation on one trip, naming a clearly different
  // destination ("plan a Spain trip...") should silently start a new trip,
  // same as tapping "+" would, not get stuck inside the open trip's context
  // asking whether to switch. See common/trips.ts's isDifferentTripRequest.
  const access = input.tripId ? await assertTripAccess(input.tripId, userId) : null;
  const startFresh = !access || (await isDifferentTripRequest(text, access.trip));

  // Switching an already-open trip to a brand new one from a single spoken
  // utterance is exactly the shape of damage fabricated Vocal Bridge turns
  // have caused (see common/voiceConfirm.ts) — require a genuine affirmative
  // follow-up before committing. Typed text carries no fabrication risk (no
  // server-side "AI agent" reformulating it), so this is scoped to voice
  // only; chat keeps the original silent, no-nag switch behavior.
  let creationText = text;
  if (access && startFresh && source === 'voice') {
    const pendingText = takePendingVoiceConfirm(userId, `switch_trip:${access.trip.id}`);
    if (pendingText == null) {
      setPendingVoiceConfirm(userId, `switch_trip:${access.trip.id}`, text);
      const reply = `I heard: "${text}" — that sounds like a different trip. Want me to start planning that, or are we still on ${access.trip.title}?`;
      await Messages.push({ tripId: access.trip.id, role: 'user', text, source, status: 'complete', authorId: userId });
      await Messages.push({ tripId: access.trip.id, role: 'agent', text: reply, source: 'chat', status: 'complete' });
      const finalTrip = await Trips.get(access.trip.id);
      return { tripId: access.trip.id, created: false, reply, version: finalTrip?.version ?? 0, trip: finalTrip };
    }
    if (isAffirmative(text)) {
      creationText = pendingText; // proceed below using what actually described the new trip, not this "yes"
    } else {
      // Not a clear yes — stay put; treat this turn as a normal continuation
      // instead of silently dropping it.
      trip = access.trip;
      requestedBy = await requestedByFor(access, userId);
      if (requestedBy) {
        authorName = requestedBy.name;
        authorColor = requestedBy.color;
      }
    }
  }

  if (!trip) {
    if (access && !startFresh) {
      trip = access.trip;
      requestedBy = await requestedByFor(access, userId);
      if (requestedBy) {
        authorName = requestedBy.name;
        authorColor = requestedBy.color;
      }
    } else {
      const meta = await extractTripMeta(creationText);
      trip = await createTripForUser(userId, meta);
      created = true;
      await stream({ type: 'trip_created', trip });
    }
  }

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

  // A brand-new trip's very first reply is always the naming question, not
  // planning — asked before anything else, per the traveler's own request,
  // so every trip gets a real identity instead of a mechanical "X to Y Trip"
  // auto-title before "people make a lot of trips" turns the trip list into
  // a wall of look-alike names.
  if (created) {
    const reply = "Before we dive in — what should we call this trip?";
    await Messages.push({ tripId: trip.id, role: 'agent', text: reply, source: 'chat', status: 'complete' });
    const finalTrip = await Trips.get(trip.id);
    return { tripId: trip.id, created, reply, version: finalTrip?.version ?? 0, trip: finalTrip };
  }

  // This turn is the traveler's answer to that naming question — take it as
  // the name (not a planning instruction), fun it up with one emoji, and
  // then pick planning back up using their original first message, so they
  // never have to repeat themselves just because naming came first.
  if (trip.namePending) {
    const funName = await funnifyTripName(text, trip.destination);
    await Trips.update(trip.id, { title: funName, namePending: false });

    const firstUserMessage = (await Messages.filter((m: Message) => m.tripId === trip.id))
      .filter((m) => m.role === 'user' && !!m.text)
      .sort((a, b) => (a.created_at ?? 0) - (b.created_at ?? 0))[0];
    const originalRequest = firstUserMessage?.text || text;

    const namedTrip = (await Trips.get(trip.id)) || trip;
    const { reply: planningReply } = await runConversation({
      trip: namedTrip,
      user,
      userText: originalRequest,
      source,
      focusNodeId: input.focusNodeId,
      requestedBy,
      priorMessages: [],
    });

    const reply = `${funName} it is!\n\n${planningReply}`;
    await Messages.push({ tripId: trip.id, role: 'agent', text: reply, source: 'chat', status: 'complete' });
    const finalTrip = await Trips.get(trip.id);
    return { tripId: trip.id, created, reply, version: finalTrip?.version ?? 0, trip: finalTrip };
  }

  // Load the prior conversation BEFORE recording this turn, so the orchestrator
  // has real memory of the back-and-forth (origin/dates/travelers it already
  // asked about), not just the current sentence plus a board snapshot. The last
  // dozen turns is plenty of context without bloating the prompt.
  const priorMessages = (await Messages.filter((m: Message) => m.tripId === trip.id))
    .filter((m) => (m.role === 'user' || m.role === 'agent') && !!m.text)
    .sort((a, b) => (a.created_at ?? 0) - (b.created_at ?? 0))
    .slice(-12)
    .map((m) => ({ role: m.role as 'user' | 'agent', text: m.text }));

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
