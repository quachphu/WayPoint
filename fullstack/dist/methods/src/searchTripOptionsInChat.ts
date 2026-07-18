import { auth } from '@mindstudio-ai/agent';
import { Conversations } from './tables/conversations';
import { ConversationMessages, MASCOT_SENDER_ID } from './tables/conversationMessages';
import { searchFlights } from './common/sabre';
import { rankFlights } from './common/rank';

// The mascot acting as a ticket agent, right inside the social chat — posts
// real (or simulated-fallback) flight options as bookable cards in the same
// thread everyone's already in, instead of redirecting to a separate board.
export async function searchTripOptionsInChat(input: { conversationId: string; destination: string; originCity?: string }) {
  const userId = auth.userId;
  if (!userId) throw new Error('Please sign in.');

  const conversation = await Conversations.get(input.conversationId);
  if (!conversation || !conversation.participantIds.includes(userId)) {
    throw new Error('Conversation not found.');
  }

  const origin = input.originCity || 'your city';
  const departDate = Date.now() + 30 * 24 * 60 * 60 * 1000; // a placeholder date a month out — no specific date was mentioned in chat

  const { offers } = await searchFlights({ origin, destination: input.destination, departDate });
  const top = rankFlights(offers).slice(0, 2);

  const created: any[] = [];
  const intro = await ConversationMessages.push({
    conversationId: input.conversationId,
    senderId: MASCOT_SENDER_ID,
    text: top.length ? `Here's what I found for ${origin} → ${input.destination}:` : `Couldn't find flight options for ${input.destination} right now — try again shortly.`,
  });
  created.push(intro);

  for (const offer of top) {
    const msg = await ConversationMessages.push({
      conversationId: input.conversationId,
      senderId: MASCOT_SENDER_ID,
      text: `${offer.carrier} ${offer.flightNumber}`,
      flightOffer: offer,
    } as any);
    created.push(msg);
  }

  const last = created[created.length - 1];
  await Conversations.update(input.conversationId, {
    lastMessageAt: last.created_at,
    lastMessagePreview: top.length ? `Found ${top.length} flight option${top.length === 1 ? '' : 's'} for ${input.destination}` : intro.text.slice(0, 140),
  });

  return {
    messages: created.map((m) => ({
      id: m.id,
      senderId: m.senderId,
      text: m.text,
      createdAt: m.created_at,
      flightOffer: m.flightOffer ?? null,
    })),
  };
}
