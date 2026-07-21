import type { FlightOffer, HotelOffer } from './types';
import { geocode } from './geocode';

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

// City/neighborhood-agnostic name templates — used only as a last resort
// when the real-hotel lookup below comes up empty (bad geocode, Overpass
// down/timed out, or a genuinely obscure area). These used to be the ONLY
// source, a fixed list of real San Francisco hotels/neighborhoods
// (Fisherman's Wharf, Japantown, Nob Hill, ...) that every simulated search
// returned verbatim regardless of the requested city — a Manhattan Beach
// search came back with "Hotel Kabuki, Japantown" just re-labeled with
// "Manhattan Beach" tacked onto the address. A generic, honestly-fake name
// still beats a real name for the wrong city, but a real name for the RIGHT
// city (below) beats both.
const HOTEL_TEMPLATES: { name: (area: string) => string; rating: number; tier: number }[] = [
  { name: (area) => `The ${area} Grand`, rating: 4.5, tier: 3 },
  { name: (area) => `Hotel ${area}`, rating: 4.3, tier: 2 },
  { name: (area) => `${area} Suites`, rating: 4.2, tier: 2 },
  { name: (area) => `The ${area} Inn`, rating: 4.1, tier: 1 },
  { name: (area) => `${area} Boutique Hotel`, rating: 4.4, tier: 2 },
  { name: (area) => `Park ${area} Hotel`, rating: 4.6, tier: 3 },
];

interface RealHotel {
  name: string;
  address: string | null;
}

const realHotelCache = new Map<string, RealHotel[]>();

// Real hotel names/addresses near the requested area, free and keyless via
// OpenStreetMap's Overpass API (same OSM family as the geocoder and the
// transit-time lookup already used elsewhere) — no pricing/availability
// (OSM doesn't have that), only real identity, which is the part that was
// actually wrong before. Empty on any failure, same "never block the UI"
// contract as lookupImage in images.ts.
async function fetchRealHotels(area: string): Promise<RealHotel[]> {
  const key = area.trim().toLowerCase();
  if (!key) return [];
  if (realHotelCache.has(key)) return realHotelCache.get(key)!;

  let hits: RealHotel[] = [];
  try {
    const geo = await geocode(area);
    if (geo) {
      // Most real-world hotels are mapped as building outlines (way), not
      // point nodes — node-only came back empty even for San Francisco. A
      // wider radius than 5km also silently returns nothing on the public
      // Overpass instance (soft-times-out rather than erroring), so this
      // stays deliberately tight — confirmed empirically, same spirit as
      // the "wide radius" comment on the real Sabre hotel search above.
      const query = `[out:json][timeout:12];(node["tourism"="hotel"]["name"](around:5000,${geo.lat},${geo.lng});way["tourism"="hotel"]["name"](around:5000,${geo.lat},${geo.lng}););out body 15;`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const res = await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain', 'User-Agent': 'WaypointHackathonApp/1.0 (DeepLearning.AI Voice AI Hackathon project)' },
          body: query,
          signal: controller.signal,
        });
        if (res.ok) {
          const json = await res.json();
          hits = (json?.elements ?? [])
            .filter((e: any) => e?.tags?.name)
            .map((e: any) => {
              const t = e.tags;
              const addr = [t['addr:housenumber'], t['addr:street'], t['addr:suburb'] || t['addr:neighbourhood']].filter(Boolean).join(' ');
              return { name: t.name as string, address: addr || null };
            });
        }
      } finally {
        clearTimeout(timeout);
      }
    }
  } catch (err) {
    console.error(`[simulate] real hotel lookup failed for "${area}":`, err);
  }
  realHotelCache.set(key, hits);
  return hits;
}

export async function simulateHotels(params: HotelSearchParams): Promise<HotelOffer[]> {
  const nights = Math.max(1, Math.round((params.checkOut - params.checkIn) / (24 * 60 * 60 * 1000)));
  const area = params.location || params.city;
  const rnd = seeded(`${params.city}${params.checkIn}`);
  const real = await fetchRealHotels(area);

  const slots =
    real.length >= 3
      ? real.slice(0, 6).map((h) => ({ name: h.name, address: h.address || `${area}, ${params.city}`, neighborhood: area }))
      : HOTEL_TEMPLATES.map((h) => ({ name: h.name(area), address: `${area}, ${params.city}`, neighborhood: area }));
  const tiers = real.length >= 3 ? [1, 2, 1, 3, 2, 1] : HOTEL_TEMPLATES.map((h) => h.tier);
  const ratings = real.length >= 3 ? [4.1, 4.3, 4.0, 4.6, 4.4, 4.2] : HOTEL_TEMPLATES.map((h) => h.rating);

  return slots.map((slot, i) => {
    const nightly = 18000 + (tiers[i] ?? 2) * 9000 + Math.round((rnd() - 0.3) * 6000);
    const nightlyCents = Math.max(14000, nightly);
    return {
      id: `sim-ht-${i}-${shortCode(4)}`,
      source: 'simulated' as const,
      name: slot.name,
      neighborhood: slot.neighborhood,
      address: slot.address,
      checkIn: params.checkIn,
      checkOut: params.checkOut,
      nights,
      nightlyCents,
      totalCents: nightlyCents * nights,
      rating: ratings[i] ?? 4.2,
      cancellable: rnd() < 0.8,
    };
  });
}
