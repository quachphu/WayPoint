import { auth } from '@mindstudio-ai/agent';
import { Conversations } from './tables/conversations';
import { ConversationMessages, MASCOT_SENDER_ID } from './tables/conversationMessages';
import { Users } from './tables/users';
import { bookFlight } from './common/sabre';
import { moneyShort } from './common/format';

// Anyone in the chat can tap "Book this flight" on an option the mascot
// posted — the resulting ticket (with its QR code) is posted back into the
// same shared thread, so everyone in the conversation sees it, not just
// whoever booked it. This never touches real payment — same simulated/cert
// booking path the main trip board uses (see common/sabre.ts).
export async function bookFlightFromChat(input: { conversationId: string; messageId: string }) {
  const userId = auth.userId;
  if (!userId) throw new Error('Please sign in.');

  const conversation = await Conversations.get(input.conversationId);
  if (!conversation || !conversation.participantIds.includes(userId)) {
    throw new Error('Conversation not found.');
  }

  const offerMessage = await ConversationMessages.get(input.messageId);
  if (!offerMessage || offerMessage.conversationId !== input.conversationId || !offerMessage.flightOffer) {
    throw new Error('That flight option is no longer available.');
  }

  // Idempotency: tapping "Book this flight" twice must not book twice. Once an
  // offer message has produced a ticket, refuse further bookings of the same one.
  if ((offerMessage as any).bookedRef) {
    throw new Error('That flight is already booked.');
  }

  const offer = offerMessage.flightOffer;
  const { bookingRef, costCents } = await bookFlight(offer);
  const booker = await Users.get(userId);

  // Mark the source offer as booked so a second tap is rejected above.
  await ConversationMessages.update(input.messageId, { bookedRef: bookingRef } as any);

  const text = `Booked! ${offer.carrier} ${offer.flightNumber} — ${moneyShort(costCents)}. Confirmation ${bookingRef}.`;
  const ticketMessage = await ConversationMessages.push({
    conversationId: input.conversationId,
    senderId: MASCOT_SENDER_ID,
    text,
    ticket: { bookingRef, costCents, offer, bookedBy: userId },
  } as any);

  await Conversations.update(input.conversationId, {
    lastMessageAt: ticketMessage.created_at,
    lastMessagePreview: text.slice(0, 140),
  });

  return {
    message: {
      id: ticketMessage.id,
      senderId: ticketMessage.senderId,
      text: ticketMessage.text,
      createdAt: ticketMessage.created_at,
      ticket: { ...ticketMessage.ticket, bookedByName: booker?.displayName || 'A traveler' },
    },
  };
}
