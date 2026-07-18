import { auth, db } from '@mindstudio-ai/agent';
import { FriendRequests } from './tables/friendRequests';
import { Users } from './tables/users';

// Incoming pending asks — surfaced as a small inbox in People Nearby so a
// request from someone outside your current scope (city/state/country
// toggle) still reaches you, not just people presently listed.
export async function listFriendRequests() {
  const userId = auth.userId;
  if (!userId) throw new Error('Please sign in.');

  const incoming = await FriendRequests.filter((r) => r.toUserId === userId && r.status === 'pending');
  const senderIds = [...new Set(incoming.map((r) => r.fromUserId))];
  const senders = senderIds.length ? await db.batch(...senderIds.map((id) => Users.get(id))) : [];
  const byId = new Map(senders.filter(Boolean).map((u) => [u!.id, u!]));

  return {
    requests: incoming
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((r) => {
        const from = byId.get(r.fromUserId);
        return {
          id: r.id,
          fromUserId: r.fromUserId,
          displayName: from?.displayName || null,
          gender: from?.gender ?? null,
          photoUrl: from?.photoUrl ?? null,
          createdAt: r.createdAt,
        };
      }),
  };
}
