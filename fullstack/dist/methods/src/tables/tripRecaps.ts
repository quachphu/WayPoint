import { db } from '@mindstudio-ai/agent';

// One row per trip, generated once a trip is complete and its owner has
// opted in. shareToken (not the raw tripId) is the public link's identity —
// this table is the only thing a genuinely unauthenticated visitor can read
// (see getRecap.ts), so it deliberately carries nothing beyond what's meant
// to be shown on the shareable page itself.
export interface TripRecap {
  tripId: string;
  shareToken: string;
  title: string;
  destination: string;
  startDate: number | null;
  endDate: number | null;
  narrative: string;
  disruptionLine: string | null;
  companions: { name: string; color: string }[];
  photoUrls: string[];
  generatedAt: number;
}

export const TripRecaps = db.defineTable<TripRecap>('trip_recaps');
