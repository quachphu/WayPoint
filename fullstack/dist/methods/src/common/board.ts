import type { FlightOffer, HotelOffer, TripNode, TripEdge } from './types';
import { estimateTransit } from './transit';

export function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

// Which 1-based trip day a timestamp falls on, given the trip's start date.
// Null in, null out — an activity with no time yet stays "unscheduled" until
// the model (or the traveler) pins it to a day.
export function computeDayIndex(tripStartDate: number | null, when: number | null | undefined): number | null {
  if (tripStartDate == null || when == null) return null;
  const startOfDay = (ms: number) => Math.floor(ms / 86400000);
  return startOfDay(when) - startOfDay(tripStartDate) + 1;
}

export function makeFlightNode(offer: FlightOffer, dayIndex: number | null = null): TripNode {
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
    dayIndex,
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

export function makeHotelNode(offer: HotelOffer, dayIndex: number | null = null, imageUrl: string | null = null): TripNode {
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
    dayIndex,
    imageUrl,
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
  dayIndex?: number | null;
  imageUrl?: string | null;
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
    dayIndex: args.dayIndex ?? null,
    imageUrl: args.imageUrl ?? null,
    detail: { category: args.category || 'Activity', blurb: args.blurb || '' },
  };
}

// A chronological connector between the previous node and the new one. Uses
// real routing (geocode + OSRM) for a genuine "how do I get there" duration
// and distance when it can, falling back to a plain heuristic guess when a
// place can't be resolved (see transit.ts).
export async function makeEdge(prev: TripNode, next: TripNode): Promise<TripEdge> {
  const est = await estimateTransit(prev, next);
  return {
    id: uid('ed'),
    from: prev.id,
    to: next.id,
    mode: est.mode,
    label: est.label,
    state: 'default',
    durationMin: est.durationMin ?? null,
    distanceKm: est.distanceKm ?? null,
  };
}
