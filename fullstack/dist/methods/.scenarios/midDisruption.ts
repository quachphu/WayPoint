import { buildSFTrip, seedConversation, DEMO_OWNER } from './_helpers/seed';
import { runDisruption } from '../src/common/disruption';

// The planned trip, but the outbound flight is delayed and the call to rebook is
// ready to place. Drops you straight into the flagship flow.
export async function midDisruption() {
  const { tripId, outboundNodeId } = await buildSFTrip();
  await seedConversation(tripId, [
    { role: 'user', text: 'Plan me a weekend in San Francisco this weekend.', source: 'voice' },
    { role: 'agent', text: "All set. You're on the 5:30 Delta nonstop Friday, staying at the Hotel Zephyr by the water." },
  ]);
  // Inject the delay + re-shop + call gate.
  await runDisruption({ tripId, nodeId: outboundNodeId, actor: DEMO_OWNER });
}
