import { auth } from '@mindstudio-ai/agent';
import { FriendRequests } from './tables/friendRequests';

export async function respondToFriendRequest(input: { requestId: string; accept: boolean }) {
  const userId = auth.userId;
  if (!userId) throw new Error('Please sign in.');

  const request = await FriendRequests.get(input.requestId);
  if (!request) throw new Error('That request no longer exists.');
  if (request.toUserId !== userId) throw new Error('Only the recipient can respond to this request.');

  const updated = await FriendRequests.update(input.requestId, {
    status: input.accept ? 'accepted' : 'declined',
    respondedAt: Date.now(),
  });
  return { request: updated };
}
