import { db } from '@mindstudio-ai/agent';
import { Trips } from '../tables/trips';
import { TripEvents } from '../tables/tripEvents';
import { deriveTripState } from './deriveTripState';

export interface NewEvent {
  kind: string;
  payload?: Record<string, any>;
  causedBy?: string | null;
}

// Append events to the log, then re-fold ALL of the trip's events into the
// materialized projection on the trip row. Every mutation goes through here so
// the projection is always a pure function of the log.
export async function recordEvents(tripId: string, actor: string, events: NewEvent[]) {
  if (events.length) {
    await db.batch(
      ...events.map((e) =>
        TripEvents.push({
          tripId,
          actor,
          kind: e.kind,
          payload: e.payload || {},
          causedBy: e.causedBy ?? null,
        }),
      ),
    );
  }
  return refoldTrip(tripId);
}

// Re-fold the full event log into the trip's projection. Hardened against a
// concurrent-write race (two people talking to the same trip at once): on each
// attempt we read the current version, derive from the FULL current log, then
// re-read the version immediately before writing. If it moved under us, another
// turn wrote a fresher projection, so we retry (re-reading the log, which now
// includes that turn's events). The append-only log is the source of truth and
// deriveTripState is pure, so even in the rare residual window the next mutation
// self-heals the cache. Events themselves always append safely; only this
// derived write needs the guard.
const REFOLD_MAX_ATTEMPTS = 4;

export async function refoldTrip(tripId: string) {
  for (let attempt = 0; attempt < REFOLD_MAX_ATTEMPTS; attempt++) {
    const [trip, events] = await db.batch(
      Trips.get(tripId),
      TripEvents.filter((e, $) => e.tripId === $.tripId, { tripId }).sortBy((e) => e.created_at), // bindings: lifts closure var so filter compiles to SQL
    );
    if (!trip) throw new Error('Trip not found.');
    const expectedVersion = trip.version || 0;
    const { nodes, edges } = deriveTripState(events as any);

    // Late version check, immediately before the write: has anyone bumped it?
    const current = await Trips.get(tripId);
    if ((current?.version || 0) !== expectedVersion && attempt < REFOLD_MAX_ATTEMPTS - 1) {
      continue; // a concurrent turn wrote; re-read the log and re-fold
    }
    const base = current?.version ?? expectedVersion;
    return Trips.update(tripId, { nodes, edges, version: base + 1 });
  }
  // Unreachable in practice; the loop always returns on the final attempt.
  throw new Error('Could not update the trip.');
}
