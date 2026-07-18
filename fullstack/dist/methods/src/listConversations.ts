import { auth, db } from '@mindstudio-ai/agent';
import { Conversations } from './tables/conversations';
import { Users } from './tables/users';

export async function listConversations() {
  const userId = auth.userId;
  if (!userId) throw new Error('Please sign in.');

  const mine = await Conversations.filter((c) => c.participantIds.includes(userId));
  mine.sort((a, b) => b.lastMessageAt - a.lastMessageAt);

  const otherIds = [...new Set(mine.flatMap((c) => c.participantIds.filter((id) => id !== userId)))];
  const others = otherIds.length ? await db.batch(...otherIds.map((id) => Users.get(id))) : [];
  const byId = new Map(others.filter(Boolean).map((u) => [u!.id, u!]));

  return {
    conversations: mine.map((c) => ({
      id: c.id,
      type: c.type,
      title: c.title ?? null,
      lastMessageAt: c.lastMessageAt,
      lastMessagePreview: c.lastMessagePreview ?? null,
      participants: c.participantIds
        .filter((id) => id !== userId)
        .map((id) => ({
          id,
          displayName: byId.get(id)?.displayName || null,
          gender: byId.get(id)?.gender ?? null,
          photoUrl: byId.get(id)?.photoUrl ?? null,
        })),
    })),
  };
}
