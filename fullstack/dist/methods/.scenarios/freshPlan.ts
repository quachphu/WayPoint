import { buildSFTrip, seedConversation } from './_helpers/seed';
import { PendingActions } from '../src/tables/pendingActions';
import { moneyShort } from '../src/common/format';
import type { FlightOffer } from '../src/common/types';

// A trip mid-planning: proposed nodes on the board and a booking waiting at the
// confirm-gate.
export async function freshPlan() {
  const { tripId, nodes } = await buildSFTrip(undefined, { confirm: false });
  await seedConversation(tripId, [
    { role: 'user', text: 'I want to go to San Francisco this weekend.', source: 'voice' },
    { role: 'agent', text: "Here's a plan. Best nonstop out is Delta Friday at 5:30 for $184, and the Hotel Zephyr is right on the water. Want me to lock in the flight?" },
  ]);

  const outbound = nodes[0];
  const offer = outbound.detail?.offer as FlightOffer;
  await PendingActions.push({
    tripId,
    nodeId: outbound.id,
    kind: 'book_flight',
    summary: `Book ${offer.carrier} ${offer.flightNumber}, ${offer.origin} to ${offer.destination}, ${moneyShort(offer.priceCents)}`,
    payload: { nodeId: outbound.id, offer },
    status: 'pending',
    resolvedAt: null,
  });
}
