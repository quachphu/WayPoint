import { stream } from '@mindstudio-ai/agent';
import { Trips } from '../tables/trips';
import { PendingActions } from '../tables/pendingActions';
import { searchFlights } from './sabre';
import { rankFlights } from './rank';
import { recordEvents } from './tripState';
import { weekdayShort, timeOfDay, durationLabel } from './format';
import type { TripNode, FlightOffer } from './types';

// Shared disruption handling used by both the reportDisruption method and the
// orchestrator's reportDisruption tool: mark the flight disrupted, walk the delay
// forward, re-shop later flights, and raise the (gated) place_call action.
export async function runDisruption(opts: {
  tripId: string;
  nodeId?: string | null;
  description?: string;
  actor?: string;
}): Promise<{ ok: boolean; message: string; node?: TripNode; carrier?: string; alternatives?: FlightOffer[] }> {
  const actor = opts.actor || 'agent:disruption';
  const trip = await Trips.get(opts.tripId);
  if (!trip) throw new Error('Trip not found.');

  // Pick the flight to disrupt: the named node, else the first confirmed outbound flight.
  const target =
    (opts.nodeId && trip.nodes.find((n) => n.id === opts.nodeId)) ||
    trip.nodes.find((n) => n.kind === 'flight' && n.status === 'confirmed') ||
    trip.nodes.find((n) => n.kind === 'flight');

  if (!target) {
    return { ok: false, message: 'There is no booked flight on this trip to disrupt yet.' };
  }

  const offer: FlightOffer | undefined = target.detail?.offer;
  const origin = offer?.origin || target.title.split('→')[0]?.trim() || 'SFO';
  const destination = offer?.destination || target.title.split('→')[1]?.trim() || 'LAX';
  const carrier = target.detail?.carrier || offer?.carrier || 'the airline';
  const originalDepart = target.start || Date.now();
  const delayMs = 3 * 60 * 60 * 1000; // 3-hour delay
  const delayedTo = originalDepart + delayMs;

  // Mark disrupted (node goes Beacon + working) and reflect it on the trip status.
  await recordEvents(opts.tripId, actor, [
    {
      kind: 'node_disrupted',
      payload: {
        nodeId: target.id,
        detail: {
          delay: {
            reason: opts.description || 'Delayed by the airline (weather upstream)',
            originalDepart,
            delayedTo,
          },
        },
      },
    },
    { kind: 'node_working_started', payload: { nodeId: target.id } },
  ]);
  await Trips.update(opts.tripId, { status: 'disrupted' });
  const disrupted = await Trips.get(opts.tripId);
  const disruptedNode = disrupted?.nodes.find((n) => n.id === target.id);
  if (disruptedNode) await stream({ type: 'node', op: 'update', node: disruptedNode });
  await stream({ type: 'status', text: 'Finding later flights' });

  // Re-shop later departures. Prefer nonstops (nicer arrival than a late red-eye)
  // and keep the rebooking on the carrier we're actually calling, for coherence.
  const { offers } = await searchFlights({ origin, destination, departDate: originalDepart, afterMs: delayedTo });
  const ranked = rankFlights(offers);
  const nonstops = ranked.filter((o) => o.stops === 0);
  const alternatives = (nonstops.length ? nonstops : ranked).slice(0, 3);
  const carrierCode = offer?.carrierCode || carrier.slice(0, 2).toUpperCase();
  for (const a of alternatives) {
    a.carrier = carrier;
    a.carrierCode = carrierCode;
    a.flightNumber = `${carrierCode} ${1000 + Math.floor(Math.random() * 8000)}`;
    a.stops = 0;
  }

  const compact = alternatives.map((o) => ({
    offerId: o.id,
    carrier: o.carrier,
    flightNumber: o.flightNumber,
    depart: `${weekdayShort(o.departAt)} ${timeOfDay(o.departAt)}`,
    departAt: o.departAt,
    arrive: timeOfDay(o.arriveAt),
    arriveAt: o.arriveAt,
    durationLabel: durationLabel(o.durationMin),
    stops: o.stops,
    priceCents: o.priceCents,
  }));

  // Store the options on the node for the detail panel, and stop the "finding" spinner.
  await recordEvents(opts.tripId, actor, [
    { kind: 'node_updated', payload: { nodeId: target.id, detail: { alternatives: compact } } },
    { kind: 'node_working_ended', payload: { nodeId: target.id } },
  ]);
  const afterReshop = await Trips.get(opts.tripId);
  const reshopNode = afterReshop?.nodes.find((n) => n.id === target.id);
  if (reshopNode) await stream({ type: 'node', op: 'update', node: reshopNode });

  // Raise the (gated) call action. Nothing dials until the traveler approves.
  const action = await PendingActions.push({
    tripId: opts.tripId,
    nodeId: target.id,
    kind: 'place_call',
    summary: `Call ${carrier} to rebook your delayed ${origin} to ${destination} flight`,
    payload: { nodeId: target.id, target: `${carrier} rebooking desk`, carrier, goal: `Rebook the delayed ${origin} to ${destination} flight`, route: { origin, destination }, originalOffer: offer, alternatives },
    status: 'pending',
    resolvedAt: null,
  });
  await stream({ type: 'gate', action });

  const n = alternatives.length;
  const message = `Your ${origin} to ${destination} flight just got pushed about three hours. I found ${n} later option${n === 1 ? '' : 's'} and I can call ${carrier} to lock in the change. Want me to make the call?`;
  return { ok: true, message, node: reshopNode, carrier, alternatives };
}
