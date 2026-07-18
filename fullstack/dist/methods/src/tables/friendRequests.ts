import { db } from '@mindstudio-ai/agent';

// One row per ask, in either direction. "Friends" isn't a separate table —
// an accepted request IS the friendship; querying both directions for
// status === 'accepted' answers "are these two friends?".
export interface FriendRequest {
  fromUserId: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: number;
  respondedAt?: number;
}

export const FriendRequests = db.defineTable<FriendRequest>('friend_requests');
