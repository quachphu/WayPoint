import type { FlightOffer, HotelOffer } from './types';

// Realistic simulated inventory. Produces the same normalized shape as the Sabre
// client so the rest of the app never branches on source. Used as the graceful
// fallback whenever Sabre can't answer (e.g. no PCC configured in cert).

export interface FlightSearchParams {
  origin: string;
  destination: string;
  departDate: number; // unix ms, any time on the target calendar day
  afterMs?: number | null; // only return departures at/after this (for re-shop)
}

export interface HotelSearchParams {
  city: string;
  location?: string;
  checkIn: number;
  checkOut: number;
}

const CARRIERS: { name: string; code: string }[] = [
  { name: 'Delta', code: 'DL' },
  { name: 'United', code: 'UA' },
  { name: 'Alaska', code: 'AS' },
  { name: 'American', code: 'AA' },
  { name: 'JetBlue', code: 'B6' },
  { name: 'Southwest', code: 'WN' },
];

const AIRPORTS: Record<string, string> = {
  SFO: 'San Francisco', LAX: 'Los Angeles', JFK: 'New York', EWR: 'Newark',
  ORD: 'Chicago', SEA: 'Seattle', DEN: 'Denver', BOS: 'Boston', AUS: 'Austin',
  MIA: 'Miami', PDX: 'Portland', SAN: 'San Diego', LAS: 'Las Vegas', DFW: 'Dallas',
};

// Deterministic-ish pseudo-random from a string seed so repeated searches feel stable.
function seeded(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function routeDurationMin(origin: string, destination: string): number {
  const key = [origin, destination].sort().join('');
  const rnd = seeded(key)();
  return Math.round(75 + rnd * 285); // 75–360 min
}

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function shortCode(len = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function airportCity(code: string): string {
  return AIRPORTS[code?.toUpperCase()] || code;
}

export function simulateFlights(params: FlightSearchParams): FlightOffer[] {
  const { origin, destination } = params;
  const day = startOfDay(params.departDate);
  const baseDur = routeDurationMin(origin, destination);
  const rnd = seeded(`${origin}${destination}${new Date(day).toDateString()}`);

  // Departure hours spread across the day.
  const hours = [6.67, 9.25, 12.5, 15, 17.25, 20.67];
  const offers: FlightOffer[] = hours.map((h, i) => {
    const carrier = CARRIERS[Math.floor(rnd() * CARRIERS.length)];
    const stops = rnd() < 0.55 ? 0 : 1;
    const dur = baseDur + (stops === 1 ? 90 + Math.round(rnd() * 80) : 0);
    const departAt = day + Math.round(h * 60) * 60 * 1000;
    const arriveAt = departAt + dur * 60 * 1000;
    const basePrice = 12000 + Math.round((baseDur / 60) * 4200);
    const priceCents = basePrice + Math.round((rnd() - 0.3) * 9000) - stops * 3000;
    return {
      id: `sim-fl-${origin}-${destination}-${i}-${shortCode(4)}`,
      source: 'simulated' as const,
      carrier: carrier.name,
      carrierCode: carrier.code,
      flightNumber: `${carrier.code}${100 + Math.floor(rnd() * 8900)}`,
      origin,
      destination,
      departAt,
      arriveAt,
      durationMin: dur,
      stops,
      priceCents: Math.max(7900, priceCents),
      fareBrand: rnd() < 0.5 ? 'Main Cabin' : 'Economy',
      cabin: 'economy',
      ttl: Date.now() + 20 * 60 * 1000,
    };
  });

  const after = params.afterMs ?? null;
  return after ? offers.filter((o) => o.departAt >= after) : offers;
}

const HOTELS: { name: string; neighborhood: string; rating: number; tier: number }[] = [
  { name: 'Hotel Zephyr', neighborhood: "Fisherman's Wharf", rating: 4.3, tier: 2 },
  { name: 'The Marker', neighborhood: 'Union Square', rating: 4.5, tier: 3 },
  { name: 'Hotel Kabuki', neighborhood: 'Japantown', rating: 4.4, tier: 2 },
  { name: 'The Laurel Inn', neighborhood: 'Pacific Heights', rating: 4.2, tier: 1 },
  { name: 'Hotel Emblem', neighborhood: 'Nob Hill', rating: 4.6, tier: 3 },
  { name: 'The Buchanan', neighborhood: 'Japantown', rating: 4.1, tier: 1 },
];

export function simulateHotels(params: HotelSearchParams): HotelOffer[] {
  const nights = Math.max(1, Math.round((params.checkOut - params.checkIn) / (24 * 60 * 60 * 1000)));
  const rnd = seeded(`${params.city}${params.checkIn}`);
  return HOTELS.map((h, i) => {
    const nightly = 18000 + h.tier * 9000 + Math.round((rnd() - 0.3) * 6000);
    const nightlyCents = Math.max(14000, nightly);
    return {
      id: `sim-ht-${i}-${shortCode(4)}`,
      source: 'simulated' as const,
      name: h.name,
      neighborhood: h.neighborhood,
      address: `${h.neighborhood}, ${params.city}`,
      checkIn: params.checkIn,
      checkOut: params.checkOut,
      nights,
      nightlyCents,
      totalCents: nightlyCents * nights,
      rating: h.rating,
      cancellable: rnd() < 0.8,
    };
  });
}
