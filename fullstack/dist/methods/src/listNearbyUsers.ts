import { auth } from '@mindstudio-ai/agent';
import { Users } from './tables/users';
import { FriendRequests } from './tables/friendRequests';
import { ageFromDob, isBirthdayToday, sharedInterestCount } from './common/profile';

// Facebook-style "people nearby" — other signed-up travelers who share the
// caller's city, region (state/province), or country, depending on scope.
// Requires the caller to have a saved location (see setLocation). Everyone in
// scope is returned (never filtered by interests) — shared hobbies/games/music
// only raise a "Recommended" flag so people with more in common stand out.
const RECOMMENDED_THRESHOLD = 2;

export type FriendStatus = 'none' | 'pending_outgoing' | 'pending_incoming' | 'friends';

export async function listNearbyUsers(input: { scope: 'city' | 'region' | 'country' }) {
  const userId = auth.userId;
  if (!userId) throw new Error('Please sign in.');

  const me = await Users.get(userId);
  const loc = me?.location;
  if (!loc?.country) return { users: [], scope: input.scope, hasLocation: false };

  const all = await Users.filter((u) => u.id !== userId && !!u.location);
  const matches = all.filter((u) => {
    const l = u.location!;
    if (input.scope === 'country') return l.country === loc.country;
    if (input.scope === 'region') return l.country === loc.country && l.region === loc.region && !!loc.region;
    return l.country === loc.country && l.region === loc.region && l.city === loc.city && !!loc.city;
  });

  // One pass over my requests (either direction) instead of a query per person.
  const myRequests = await FriendRequests.filter((r) => r.fromUserId === userId || r.toUserId === userId);
  const requestFor = (otherId: string) =>
    myRequests.find((r) => (r.fromUserId === userId && r.toUserId === otherId) || (r.fromUserId === otherId && r.toUserId === userId));

  return {
    scope: input.scope,
    hasLocation: true,
    users: matches
      .map((u) => {
        const shared = me ? sharedInterestCount(me, u) : 0;
        const req = requestFor(u.id);
        let friendStatus: FriendStatus = 'none';
        let friendRequestId: string | null = null;
        if (req && req.status === 'accepted') {
          friendStatus = 'friends';
        } else if (req && req.status === 'pending') {
          friendStatus = req.fromUserId === userId ? 'pending_outgoing' : 'pending_incoming';
          friendRequestId = req.id;
        }
        return {
          id: u.id,
          displayName: u.displayName || null,
          city: u.location?.city ?? null,
          region: u.location?.region ?? null,
          country: u.location?.country ?? null,
          gender: u.gender ?? null,
          photoUrl: u.photoUrl ?? null,
          age: ageFromDob(u.dateOfBirth),
          isBirthdayToday: isBirthdayToday(u.dateOfBirth),
          profession: u.profession ?? null,
          hobbies: u.hobbies ?? [],
          favoriteGames: u.favoriteGames ?? [],
          favoriteMusic: u.favoriteMusic ?? [],
          languages: u.languages ?? [],
          sharedInterestCount: shared,
          recommended: shared >= RECOMMENDED_THRESHOLD,
          friendStatus,
          friendRequestId,
        };
      })
      // Recommended (more in common) travelers surface first, then by shared count.
      .sort((a, b) => b.sharedInterestCount - a.sharedInterestCount),
  };
}
