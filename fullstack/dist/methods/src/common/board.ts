import type { FlightOffer, HotelOffer, TripNode, TripEdge, EdgeMode } from './types';
import { durationLabel } from './format';

export function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function makeFlightNode(offer: FlightOffer): TripNode {
  return {
    id: uid('nd'),
    kind: 'flight',
    title: `${offer.origin} → ${offer.destination}`,
    subtitle: `${offer.carrier} ${offer.flightNumber}`,
    start: offer.departAt,
    end: offer.arriveAt,
    location: offer.destination,
    status: 'proposed',
    working: false,
    bookingRef: null,
    costCents: offer.priceCents,
    dependsOn: [],
    detail: {
      offerId: offer.id,
      source: offer.source,
      carrier: offer.carrier,
      flightNumber: offer.flightNumber,
      stops: offer.stops,
      durationMin: offer.durationMin,
      fareBrand: offer.fareBrand,
      cabin: offer.cabin,
      offer,
    },
  };
}

export function makeHotelNode(offer: HotelOffer): TripNode {
  return {
    id: uid('nd'),
    kind: 'hotel',
    title: offer.name,
    subtitle: `${offer.nights} night${offer.nights === 1 ? '' : 's'} · ${offer.neighborhood}`,
    start: offer.checkIn,
    end: offer.checkOut,
    location: offer.neighborhood,
    status: 'proposed',
    working: false,
    bookingRef: null,
    costCents: offer.totalCents,
    dependsOn: [],
    detail: {
      offerId: offer.id,
      source: offer.source,
      name: offer.name,
      neighborhood: offer.neighborhood,
      address: offer.address,
      nightlyCents: offer.nightlyCents,
      rating: offer.rating,
      cancellable: offer.cancellable,
      nights: offer.nights,
      offer,
    },
  };
}

export function makeActivityNode(args: {
  name: string;
  category?: string;
  neighborhood?: string;
  blurb?: string;
  start?: number | null;
  end?: number | null;
}): TripNode {
  return {
    id: uid('nd'),
    kind: 'activity',
    title: args.name,
    subtitle: args.neighborhood || args.category || 'Activity',
    start: args.start ?? null,
    end: args.end ?? null,
    location: args.neighborhood || '',
    status: 'proposed',
    working: false,
    bookingRef: null,
    costCents: null,
    dependsOn: [],
    detail: { category: args.category || 'Activity', blurb: args.blurb || '' },
  };
}

// A chronological connector between the previous node and the new one, with an
// inferred mode and a human label ("1h 15m flight", "20 min drive").
export function makeEdge(prev: TripNode, next: TripNode): TripEdge {
  let mode: EdgeMode;
  let label: string;
  if (next.kind === 'flight') {
    mode = 'flight';
    const min = next.detail?.durationMin;
    label = min ? `${durationLabel(min)} flight` : 'flight';
  } else if (next.kind === 'activity' && prev.kind === 'activity') {
    mode = 'walk';
    label = '12 min walk';
  } else if (prev.kind === 'flight' && next.kind === 'hotel') {
    mode = 'drive';
    label = '20 min drive';
  } else if (next.kind === 'activity') {
    mode = 'walk';
    label = '15 min walk';
  } else {
    mode = 'drive';
    label = '20 min drive';
  }
  return { id: uid('ed'), from: prev.id, to: next.id, mode, label, state: 'default' };
}
