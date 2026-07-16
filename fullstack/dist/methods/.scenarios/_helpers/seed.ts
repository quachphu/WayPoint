import { Trips } from '../../src/tables/trips';
import { Messages } from '../../src/tables/messages';
import { recordEvents } from '../../src/common/tripState';
import { DEMO_OWNER } from '../../src/common/trips';
import { makeFlightNode, makeHotelNode, makeActivityNode, makeEdge } from '../../src/common/board';
import { shortCode } from '../../src/common/simulate';
import type { FlightOffer, HotelOffer, TripNode } from '../../src/common/types';

export { DEMO_OWNER };

// Naive-local time helpers matching format.ts (UTC-based wall clock).
function nextFridayUTC(): number {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  const add = ((5 - d.getUTCDay() + 7) % 7) || 7; // next Friday
  d.setUTCDate(d.getUTCDate() + add);
  return d.getTime();
}
const at = (dayMs: number, hour: number, min = 0) => dayMs + (hour * 60 + min) * 60000;
const DAY = 24 * 60 * 60 * 1000;

export interface BuiltTrip {
  tripId: string;
  outboundNodeId: string;
  nodes: TripNode[];
}

// Build the "Weekend in San Francisco" trip from events (so the projection and
// history are real), leaving nodes at the given confirmation state.
export async function buildSFTrip(owner: string = DEMO_OWNER, opts: { confirm: boolean } = { confirm: true }): Promise<BuiltTrip> {
  const fri = nextFridayUTC();
  const sun = fri + 2 * DAY;

  const outbound: FlightOffer = {
    id: `seed-fl-${shortCode(4)}`, source: 'simulated', carrier: 'Delta', carrierCode: 'DL', flightNumber: 'DL 2272',
    origin: 'LAX', destination: 'SFO', departAt: at(fri, 17, 30), arriveAt: at(fri, 18, 45), durationMin: 75, stops: 0,
    priceCents: 18400, fareBrand: 'Main Cabin', cabin: 'economy', ttl: null,
  };
  const ret: FlightOffer = {
    id: `seed-fl-${shortCode(4)}`, source: 'simulated', carrier: 'Alaska', carrierCode: 'AS', flightNumber: 'AS 1180',
    origin: 'SFO', destination: 'LAX', departAt: at(sun, 18, 40), arriveAt: at(sun, 20, 5), durationMin: 85, stops: 0,
    priceCents: 16900, fareBrand: 'Main Cabin', cabin: 'economy', ttl: null,
  };
  const hotel: HotelOffer = {
    id: `seed-ht-${shortCode(4)}`, source: 'simulated', name: 'Hotel Zephyr', neighborhood: "Fisherman's Wharf",
    address: "250 Beach St, San Francisco", checkIn: fri, checkOut: sun, nights: 2, nightlyCents: 30600, totalCents: 61200,
    rating: 4.3, cancellable: true,
  };

  const nOutbound = makeFlightNode(outbound);
  const nHotel = makeHotelNode(hotel);
  const nDinner = makeActivityNode({ name: 'Dinner at the Ferry Building', category: 'Food', neighborhood: 'Embarcadero', blurb: 'Waterfront marketplace with local food stalls and restaurants.', start: at(fri + 0, 20, 0) });
  const nBay = makeActivityNode({ name: 'Golden Gate & Baker Beach', category: 'Sightseeing', neighborhood: 'Presidio', blurb: 'Classic views of the bridge from the northern trails.', start: at(fri + DAY, 11, 0) });
  const nReturn = makeFlightNode(ret);

  const ordered = [nOutbound, nHotel, nDinner, nBay, nReturn];
  const events: { kind: string; payload: any }[] = ordered.map((n) => ({ kind: 'node_proposed', payload: n }));
  for (let i = 1; i < ordered.length; i++) {
    events.push({ kind: 'edge_added', payload: makeEdge(ordered[i - 1], ordered[i]) });
  }
  if (opts.confirm) {
    for (const n of ordered) {
      events.push({ kind: 'node_confirmed', payload: { nodeId: n.id, bookingRef: n.kind === 'activity' ? null : shortCode(6), costCents: n.costCents } });
    }
  }

  const trip = await Trips.push({
    userId: owner, title: 'Weekend in San Francisco', destination: 'San Francisco', origin: 'LAX',
    startDate: fri, endDate: sun, status: opts.confirm ? 'confirmed' : 'planning', nodes: [], edges: [], version: 0,
  });
  await recordEvents(trip.id, owner, events);

  return { tripId: trip.id, outboundNodeId: nOutbound.id, nodes: ordered };
}

export async function seedConversation(tripId: string, turns: { role: 'user' | 'agent'; text: string; source?: 'voice' | 'chat' | 'system' }[]) {
  for (const t of turns) {
    await Messages.push({ tripId, role: t.role, text: t.text, source: t.source || 'chat', status: 'complete' });
  }
}
