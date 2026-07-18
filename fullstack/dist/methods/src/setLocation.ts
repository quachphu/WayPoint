import { auth } from '@mindstudio-ai/agent';
import { Users } from './tables/users';

// Called once per sign-in from the browser (geolocation → reverse-geocoded
// client-side) so "people nearby" stays based on where the traveler actually
// is, not a stale value from months ago.
export async function setLocation(input: { city?: string; region?: string; country?: string; lat?: number; lng?: number }) {
  const userId = auth.userId;
  if (!userId) throw new Error('Please sign in.');

  const user = await Users.update(userId, {
    location: {
      city: input.city,
      region: input.region,
      country: input.country,
      lat: input.lat,
      lng: input.lng,
      updatedAt: Date.now(),
    },
  });
  return { user };
}
