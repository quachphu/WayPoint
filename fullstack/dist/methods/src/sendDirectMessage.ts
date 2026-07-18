import { auth } from '@mindstudio-ai/agent';
import { Conversations } from './tables/conversations';
import { ConversationMessages, MASCOT_SENDER_ID } from './tables/conversationMessages';
import { Users } from './tables/users';
import { detectTripMention } from './common/tripMention';

// When a message expresses real trip intent ("thinking Paris in June?"), the
// mascot posts a follow-up suggestion in the same thread — one shared
// message, using whoever mentioned it as the origin point, with a
// "Plan this trip" button the client renders from `tripSuggestion`.
export async function sendDirectMessage(input: { conversationId: string; text: string }) {
  const userId = auth.userId;
  if (!userId) throw new Error('Please sign in.');
  const text = input.text.trim();
  if (!text) throw new Error('Say something first.');

  const conversation = await Conversations.get(input.conversationId);
  if (!conversation || !conversation.participantIds.includes(userId)) {
    throw new Error('Conversation not found.');
  }

  const message = await ConversationMessages.push({ conversationId: input.conversationId, senderId: userId, text });
  await Conversations.update(input.conversationId, {
    lastMessageAt: message.created_at,
    lastMessagePreview: text.slice(0, 140),
  });

  let suggestionMessage: (typeof message) | null = null;
  const mention = await detectTripMention(text);
  if (mention) {
    const sender = await Users.get(userId);
    const originCity = sender?.location?.city || undefined;
    const suggestionText = `Sounds like a plan! Want help booking ${mention.destination}${originCity ? ` from ${originCity}` : ''}?`;
    suggestionMessage = await ConversationMessages.push({
      conversationId: input.conversationId,
      senderId: MASCOT_SENDER_ID,
      text: suggestionText,
      tripSuggestion: { destination: mention.destination, originCity },
    } as any);
    await Conversations.update(input.conversationId, {
      lastMessageAt: suggestionMessage.created_at,
      lastMessagePreview: suggestionText.slice(0, 140),
    });
  }

  return {
    message: { id: message.id, senderId: message.senderId, text: message.text, createdAt: message.created_at },
    suggestionMessage: suggestionMessage && {
      id: suggestionMessage.id,
      senderId: suggestionMessage.senderId,
      text: suggestionMessage.text,
      createdAt: suggestionMessage.created_at,
      tripSuggestion: suggestionMessage.tripSuggestion,
    },
  };
}
