import { db } from '@mindstudio-ai/agent';

// The append-only source of truth. Current trip state is derived by folding
// these in created_at order. Never updated or deleted, only appended.
export interface TripEvent {
  tripId: string;
  actor: string; // user id, or "agent:planner" / "agent:disruption" / "system"
  kind: string; // see deriveTripState for the handled kinds
  payload: Record<string, any>;
  causedBy: string | null; // id of a prior event, for causal chains
}

export const TripEvents = db.defineTable<TripEvent>('trip_events');
