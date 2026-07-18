import { FriendRequests, type FriendRequest } from '../tables/friendRequests';

export async function areFriends(userA: string, userB: string): Promise<boolean> {
  const rows = await FriendRequests.filter(
    (r) =>
      r.status === 'accepted' &&
      ((r.fromUserId === userA && r.toUserId === userB) || (r.fromUserId === userB && r.toUserId === userA)),
  );
  return rows.length > 0;
}

// The one request row between two people, regardless of who sent it —
// there should only ever be one live (non-declined) row per pair.
export async function requestBetween(userA: string, userB: string): Promise<(FriendRequest & { id: string }) | null> {
  const rows = await FriendRequests.filter(
    (r) => (r.fromUserId === userA && r.toUserId === userB) || (r.fromUserId === userB && r.toUserId === userA),
  );
  const live = rows.filter((r) => r.status !== 'declined');
  return live[0] ?? null;
}
