import { auth } from '@mindstudio-ai/agent';
import { FriendRequests } from './tables/friendRequests';
import { requestBetween } from './common/friends';

// Sending a request to someone who already asked you auto-accepts theirs
// instead of creating a second, redundant pending row in the other
// direction — if you both wanted to connect, there's nothing left to ask.
export async function sendFriendRequest(input: { toUserId: string }) {
  const userId = auth.userId;
  if (!userId) throw new Error('Please sign in.');
  if (input.toUserId === userId) throw new Error("You can't friend yourself.");

  const existing = await requestBetween(userId, input.toUserId);
  if (existing) {
    if (existing.status === 'accepted') return { request: existing };
    if (existing.fromUserId === userId) return { request: existing }; // already pending from me
    // They'd already asked me — accept theirs rather than double up.
    const accepted = await FriendRequests.update(existing.id, { status: 'accepted', respondedAt: Date.now() });
    return { request: accepted };
  }

  const request = await FriendRequests.push({
    fromUserId: userId,
    toUserId: input.toUserId,
    status: 'pending',
    createdAt: Date.now(),
  } as any);
  return { request };
}
