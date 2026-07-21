import { db } from '@mindstudio-ai/agent';
import type { TripNode, TripEdge } from '../common/types';

// The materialized projection of a trip's event log, plus metadata.
// nodes and edges are a pure fold of trip_events, cached here for fast board reads.
export interface Trip {
  userId: string;
  title: string;
  destination: string;
  origin?: string; // traveler's departure city / airport
  startDate: number | null; // unix ms
  endDate: number | null; // unix ms
  status: 'planning' | 'confirmed' | 'disrupted' | 'complete';
  nodes: TripNode[];
  edges: TripEdge[];
  version: number; // bumped on every re-fold
  // True from creation until the traveler answers the agent's first
  // question — what to call the trip. While true, converse.ts intercepts
  // the next turn as the naming answer instead of routing it into the
  // normal planning tool loop.
  namePending?: boolean;
}

export const Trips = db.defineTable<Trip>('trips');
