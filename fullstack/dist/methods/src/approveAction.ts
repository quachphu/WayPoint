import { auth } from '@mindstudio-ai/agent';
import { Trips } from './tables/trips';
import { Users } from './tables/users';
import { PendingActions, type PendingAction } from './tables/pendingActions';
import { CallSessions } from './tables/callSessions';
import { bookFlight, bookHotel } from './common/sabre';
import { recordEvents } from './common/tripState';
import { disclosureLine } from './common/callScript';
import { assertTripAccess } from './common/collaborators';
import { maybeCreateSplit, activeExpensesForTrip } from './common/expenses';
import type { FlightOffer, HotelOffer } from './common/types';

// The ONLY path that executes a real booking or an outbound call. Hard-refuses
// unless the pending action is still 'pending'. This is the code-level gate and
// the prompt-injection defense: nothing an agent or a call transcript produced
// can spend or dial without arriving here from an explicit traveler approval.
export async function approveAction(input: { actionId: string }) {
  const userId = auth.userId;
  if (!userId) throw new Error('Please sign in.');

  const action = await PendingActions.get(input.actionId);
  if (!action) throw new Error('That request is no longer available.');
  // Owner or active companion may reach the trip; approval rights are stricter.
  const access = await assertTripAccess(action.tripId, userId);
  const trip = access.trip;

  // Spending stays with the owner (and any promoted companion). A companion
  // without approval rights can ask, but only an approver clears the gate.
  if (!access.canApprove) {
    throw new Error('Only the trip owner can approve this. It is waiting for them.');
  }

  // The gate: refuse anything not still pending (double-submit / stale gate).
  if (action.status !== 'pending') throw new Error('This has already been handled.');
  await PendingActions.update(action.id, { status: 'approved' });

  try {
    if (action.kind === 'place_call') {
      // Greenlight the call by creating the session; the streamed runCall drives it.
      const user = await Users.get(userId);
      const p = action.payload || {};
      const call = await CallSessions.push({
        tripId: trip.id,
        nodeId: p.nodeId || action.nodeId || '',
        kind: 'to_venue',
        userId: trip.userId,
        target: p.target || 'the airline',
        goal: p.goal || 'Rebook the flight',
        disclosureLine: disclosureLine(user?.displayName), // hardcoded, stored verbatim
        status: 'dialing',
        subStatus: 'Connecting',
        transcript: [],
        outcome: null,
        consentBasis: 'Simulated call — no real third party contacted',
        context: p,
        startedAt: Date.now(),
        endedAt: null,
      });
      await PendingActions.update(action.id, { status: 'executed', resolvedAt: Date.now() });
      return { ok: true, kind: 'place_call' as const, callSessionId: call.id, tripId: trip.id };
    }

    if (action.kind === 'book_flight' || action.kind === 'book_hotel' || action.kind === 'book_activity') {
      await executeBooking(action);
      // Split the Bill: fully opt-in via maybeCreateSplit's own checks (no-op
      // on a solo trip or one with no other active companions).
      await maybeCreateSplit(action.tripId, action.payload?.nodeId || action.nodeId, trip.userId);
    } else if (action.kind === 'rebook') {
      await executeRebook(action);
    }
    await PendingActions.update(action.id, { status: 'executed', resolvedAt: Date.now() });
  } catch (err) {
    console.error('[approveAction] execution failed:', err);
    await PendingActions.update(action.id, { status: 'pending' }); // let the traveler retry
    throw new Error('That did not go through, and nothing was charged. Want to try again?');
  }

  const finalTrip = await Trips.get(trip.id);
  const expenses = await activeExpensesForTrip(trip.id);
  return { ok: true, kind: action.kind, tripId: trip.id, version: finalTrip?.version ?? 0, trip: finalTrip, expenses };
}

async function executeBooking(action: PendingAction & { id: string }) {
  const p = action.payload || {};
  const nodeId = p.nodeId || action.nodeId;
  const offer = p.offer;
  if (!nodeId || !offer) throw new Error('Missing booking payload.');

  if (action.kind === 'book_flight') {
    const { bookingRef, costCents } = await bookFlight(offer as FlightOffer);
    await recordEvents(action.tripId, 'system', [{ kind: 'node_confirmed', payload: { nodeId, bookingRef, costCents } }]);
  } else if (action.kind === 'book_hotel') {
    const { bookingRef, costCents } = await bookHotel(offer as HotelOffer);
    await recordEvents(action.tripId, 'system', [{ kind: 'node_confirmed', payload: { nodeId, bookingRef, costCents } }]);
  } else {
    await recordEvents(action.tripId, 'system', [{ kind: 'node_confirmed', payload: { nodeId, bookingRef: null, costCents: null } }]);
  }
  await refreshTripStatus(action.tripId);
}

async function executeRebook(action: PendingAction & { id: string }) {
  const p = action.payload || {};
  const nodeId = p.nodeId || action.nodeId;
  const newOffer = p.newOffer as FlightOffer;
  if (!nodeId || !newOffer) throw new Error('Missing rebook payload.');

  const { bookingRef, costCents } = await bookFlight(newOffer);
  await recordEvents(action.tripId, 'system', [
    {
      kind: 'rebooked',
      payload: {
        nodeId,
        patch: {
          title: `${newOffer.origin} → ${newOffer.destination}`,
          subtitle: `${newOffer.carrier} ${newOffer.flightNumber}`,
          start: newOffer.departAt,
          end: newOffer.arriveAt,
          costCents,
          bookingRef,
        },
        detail: {
          offer: newOffer,
          source: newOffer.source,
          carrier: newOffer.carrier,
          flightNumber: newOffer.flightNumber,
          stops: newOffer.stops,
          durationMin: newOffer.durationMin,
        },
      },
    },
  ]);
  await refreshTripStatus(action.tripId);
}

// Recompute the trip's headline status from its nodes.
async function refreshTripStatus(tripId: string) {
  const trip = await Trips.get(tripId);
  if (!trip) return;
  const anyDisrupted = trip.nodes.some((n) => n.status === 'disrupted');
  const anyProposed = trip.nodes.some((n) => (n.kind === 'flight' || n.kind === 'hotel') && n.status === 'proposed');
  const status = anyDisrupted ? 'disrupted' : anyProposed ? 'planning' : 'confirmed';
  if (status !== trip.status) await Trips.update(tripId, { status });
}
