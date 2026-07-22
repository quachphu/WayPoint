import { TripRecaps } from './tables/tripRecaps';

// Deliberately public — no auth.userId check. This is the one thing in the
// whole app a genuinely unauthenticated visitor can read: the person a trip
// was shared with may never have a Waypoint account. Returns only the
// public-safe fields, never the raw tripId/shareToken.
export async function getRecap(input: { token: string }) {
  const token = (input.token || '').trim();
  if (!token) return { recap: null };

  const rows = await TripRecaps.filter(
    (r, $) => r.shareToken === $.token,
    { token }, // bindings: lifts closure var so filter compiles to SQL
  );
  const row = rows[0];
  if (!row) return { recap: null };

  return {
    recap: {
      title: row.title,
      destination: row.destination,
      startDate: row.startDate,
      endDate: row.endDate,
      narrative: row.narrative,
      disruptionLine: row.disruptionLine,
      companions: row.companions,
      photoUrls: row.photoUrls,
    },
  };
}
