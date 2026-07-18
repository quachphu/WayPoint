import { auth } from '@mindstudio-ai/agent';
import { Conversations } from './tables/conversations';
import { areFriends } from './common/friends';

// Starts (or reuses) a direct chat with exactly one other person, or creates
// a fresh group chat for two or more. Direct chats are deduplicated so
// messaging the same person twice reopens the existing thread.
//
// Friendship gate: a direct chat requires the two people to already be
// friends. A group chat only requires the CREATOR to be friends with each
// invitee — the invitees don't need to be friends with each other (the
// creator is the connector; the group itself is what introduces them).
export async function startConversation(input: { userIds: string[]; title?: string }) {
  const userId = auth.userId;
  if (!userId) throw new Error('Please sign in.');

  const others = [...new Set(input.userIds)].filter((id) => id !== userId);
  if (others.length === 0) throw new Error('Pick at least one person to message.');

  for (const other of others) {
    if (!(await areFriends(userId, other))) {
      throw new Error("You can only start a chat with people you're friends with.");
    }
  }

  const participantIds = [userId, ...others].sort();
  const isDirect = participantIds.length === 2;

  if (isDirect) {
    const existing = await Conversations.filter(
      (c) => c.type === 'direct' && c.participantIds.length === 2 && c.participantIds.every((id) => participantIds.includes(id)),
    );
    if (existing.length) return { conversation: existing[0] };
  }

  const conversation = await Conversations.push({
    type: isDirect ? 'direct' : 'group',
    title: isDirect ? undefined : input.title || 'New group',
    participantIds,
    createdBy: userId,
    lastMessageAt: Date.now(),
  });
  return { conversation };
}
