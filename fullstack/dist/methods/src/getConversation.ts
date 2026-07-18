import { auth, db } from '@mindstudio-ai/agent';
import { Conversations } from './tables/conversations';
import { ConversationMessages } from './tables/conversationMessages';
import { Users } from './tables/users';

export async function getConversation(input: { conversationId: string }) {
  const userId = auth.userId;
  if (!userId) throw new Error('Please sign in.');

  const conversation = await Conversations.get(input.conversationId);
  if (!conversation || !conversation.participantIds.includes(userId)) {
    throw new Error('Conversation not found.');
  }

  const [messages, participants] = await db.batch(
    ConversationMessages.filter((m) => m.conversationId === input.conversationId).sortBy((m) => m.created_at),
    Promise.all(conversation.participantIds.map((id) => Users.get(id))),
  );
  const nameById = new Map(participants.filter(Boolean).map((u) => [u!.id, u!.displayName || 'A traveler']));

  return {
    conversation: {
      id: conversation.id,
      type: conversation.type,
      title: conversation.title ?? null,
      participants: participants
        .filter(Boolean)
        .map((u) => ({
          id: u!.id,
          displayName: u!.displayName || null,
          gender: u!.gender ?? null,
          photoUrl: u!.photoUrl ?? null,
          isMe: u!.id === userId,
        })),
    },
    messages: messages.map((m) => ({
      id: m.id,
      senderId: m.senderId,
      text: m.text,
      createdAt: m.created_at,
      tripSuggestion: m.tripSuggestion ?? null,
      flightOffer: m.flightOffer ?? null,
      ticket: m.ticket ? { ...m.ticket, bookedByName: nameById.get(m.ticket.bookedBy) || 'A traveler' } : null,
    })),
  };
}
