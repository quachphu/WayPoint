import { auth, db } from '@mindstudio-ai/agent';
import { Users } from './tables/users';
import { FriendRequests } from './tables/friendRequests';

// Every accepted friend, location-independent — unlike listNearbyUsers'
// friendStatus field, which only ever covers people currently in your
// selected city/state/country scope. This is what backs a real "pick from
// all my friends" picker (e.g. starting a group chat).
export async function listFriends() {
  const userId = auth.userId;
  if (!userId) throw new Error('Please sign in.');

  const rows = await FriendRequests.filter(
    (r, $) => r.status === 'accepted' && (r.fromUserId === $.userId || r.toUserId === $.userId),
    { userId }, // bindings: lifts closure var so filter compiles to SQL
  );
  const otherIds = [...new Set(rows.map((r) => (r.fromUserId === userId ? r.toUserId : r.fromUserId)))];
  const users = otherIds.length ? await db.batch(...otherIds.map((id) => Users.get(id))) : [];

  return {
    friends: users.filter(Boolean).map((u: any) => ({
      id: u.id,
      displayName: u.displayName || null,
      photoUrl: u.photoUrl || null,
      gender: u.gender || null,
    })),
  };
}
