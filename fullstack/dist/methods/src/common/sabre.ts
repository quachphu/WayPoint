import type { FlightOffer, HotelOffer } from './types';
import {
  simulateFlights,
  simulateHotels,
  shortCode,
  type FlightSearchParams,
  type HotelSearchParams,
} from './simulate';
import { geocode } from './geocode';

// Sabre client. Calls the real cert environment when a token is present, and
// transparently falls back to simulated inventory (identical shape) on ANY
// error so the experience always completes. Every fallback is logged with the
// real reason via console.error.
//
// This hits the modern Flight Shop v1 / Hotels Search v1 APIs — confirmed
// live against this project's hackathon credentials on 2026-07-18 (see
// docs/09_SABRE_LIVE_VERIFIED.md). This is a DIFFERENT, newer product family
// than the classic Bargain Finder Max (BFM) v5 the code originally called;
// BFM needs a PseudoCityCode this account was never issued, which is why
// every search silently fell back to simulated data before this rewrite.

const BASE =
  process.env.SABRE_ENV === 'prod'
    ? 'https://api.platform.sabre.com'
    : 'https://api.cert.platform.sabre.com';

function sabreConfigured(): boolean {
  // Flight Shop / Hotels Search v1 don't need a PseudoCityCode in the request
  // body at all — it's tied to the token server-side. A bearer token is the
  // only prerequisite for a real call.
  return !!process.env.SABRE_TOKEN;
}

async function sabreFetch(path: string, body: unknown): Promise<any> {
  const token = process.env.SABRE_TOKEN;
  if (!token) throw new Error('SABRE_TOKEN not set');
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  // fetch does not throw on non-2xx — check res.ok ourselves.
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Sabre ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

const AIRLINE_NAMES: Record<string, string> = {
  UA: 'United', AA: 'American', DL: 'Delta', WN: 'Southwest', AS: 'Alaska',
  B6: 'JetBlue', F9: 'Frontier', NK: 'Spirit', HA: 'Hawaiian', G4: 'Allegiant',
  LH: 'Lufthansa', BA: 'British Airways', AF: 'Air France', KL: 'KLM',
};

function toIsoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

// Sabre gives local-clock date+time strings with no offset (e.g.
// "2026-07-25" + "19:30"), same fidelity as the simulated generator (no
// per-airport timezone modeling) — combining them as a plain local timestamp
// keeps every downstream consumer (board, transit, day index) consistent.
function combineDateTime(date: string, time: string): number {
  return new Date(`${date}T${time}:00`).getTime();
}

export async function searchFlights(
  params: FlightSearchParams,
): Promise<{ offers: FlightOffer[]; source: 'sabre' | 'simulated' }> {
  try {
    if (!sabreConfigured()) throw new Error('SABRE_TOKEN not configured; using simulated inventory');
    const body = {
      journeys: [
        {
          departureLocation: { airportCode: params.origin },
          arrivalLocation: { airportCode: params.destination },
          departureDate: toIsoDate(params.departDate),
        },
      ],
      travelers: [{ passengerTypeCode: 'ADT' }],
    };
    const json = await sabreFetch('/v1/offers/flightShop', body);
    const offers = parseFlightShopResponse(json);
    if (!offers.length) throw new Error('Sabre returned no offers');
    const after = params.afterMs ?? null;
    return { offers: after ? offers.filter((o) => o.departAt >= after) : offers, source: 'sabre' };
  } catch (err: any) {
    console.error('[sabre] flight search fell back to simulated:', err?.message || err);
    return { offers: simulateFlights(params), source: 'simulated' };
  }
}

// Flat, modern shape (not the OTA/BFM envelope): top-level flights[] are the
// individual legs, journeys[] group ordered flightRefs into an itinerary
// (multiple refs = a connection), and offers[] price a journeyRefs bundle.
// Guarded end to end — any shape surprise throws and triggers the simulated
// fallback above rather than emitting a partially-wrong offer.
function parseFlightShopResponse(json: any): FlightOffer[] {
  const flightById = new Map<string, any>((json?.flights ?? []).map((f: any) => [f.id, f]));
  const journeyById = new Map<string, any>((json?.journeys ?? []).map((j: any) => [j.id, j]));
  const out: FlightOffer[] = [];

  for (const offer of (json?.offers ?? []).slice(0, 12)) {
    try {
      const journey = journeyById.get(offer?.journeyRefs?.[0]);
      const legs = (journey?.flightRefs ?? []).map((ref: string) => flightById.get(ref)).filter(Boolean);
      if (!legs.length) continue;
      const first = legs[0];
      const last = legs[legs.length - 1];
      const departAt = combineDateTime(first.departureDate, first.departureTime);
      const arriveAt = combineDateTime(last.arrivalDate, last.arrivalTime);
      if (isNaN(departAt) || isNaN(arriveAt)) continue;

      const fare = offer?.items?.[0]?.fares?.[0];
      const priceAmount = parseFloat(offer?.totalPrice?.amount);
      if (isNaN(priceAmount)) continue;
      const carrierCode = first.marketingAirlineCode || first.operatingAirlineCode || 'XX';
      const fareComponent = fare?.fareComponents?.[0];

      out.push({
        id: `sabre-${offer.id}`,
        source: 'sabre',
        carrier: AIRLINE_NAMES[carrierCode] || carrierCode,
        carrierCode,
        flightNumber: `${carrierCode}${first.marketingFlightNumber ?? first.operatingFlightNumber ?? ''}`,
        origin: first.departureAirportCode,
        destination: last.arrivalAirportCode,
        departAt,
        arriveAt,
        durationMin: Math.max(1, Math.round((arriveAt - departAt) / 60000)),
        stops: Math.max(0, legs.length - 1),
        priceCents: Math.round(priceAmount * 100),
        fareBrand: fareComponent?.brand?.name || 'Published',
        cabin: (fareComponent?.segmentDetails?.[0]?.cabinName || 'economy').toLowerCase(),
        ttl: offer.validUntil ? Date.parse(offer.validUntil) : Date.now() + 20 * 60 * 1000,
        raw: offer,
      });
    } catch {
      continue; // one malformed offer never sinks the rest of the search
    }
  }
  return out;
}

export async function searchHotels(
  params: HotelSearchParams,
): Promise<{ offers: HotelOffer[]; source: 'sabre' | 'simulated' }> {
  try {
    if (!sabreConfigured()) throw new Error('SABRE_TOKEN not configured; using simulated inventory');
    const geo = await geocode(params.location || params.city);
    if (!geo) throw new Error(`Could not geocode "${params.city}" for hotel search`);
    const body = {
      checkInDate: toIsoDate(params.checkIn),
      checkOutDate: toIsoDate(params.checkOut),
      numberOfAdults: 1,
      latitude: geo.lat,
      longitude: geo.lng,
      // Cert inventory is sparse — a wide radius is what actually returns more
      // than a single result; confirmed empirically against this account.
      radiusInMiles: 25,
    };
    const json = await sabreFetch('/v1/hotels/hotelSearch', body);
    const offers = parseHotelSearchResponse(json, params);
    if (!offers.length) throw new Error('Sabre returned no hotels in range');
    return { offers, source: 'sabre' };
  } catch (err: any) {
    console.error('[sabre] hotel search fell back to simulated:', err?.message || err);
    return { offers: await simulateHotels(params), source: 'simulated' };
  }
}

function parseHotelSearchResponse(json: any, params: HotelSearchParams): HotelOffer[] {
  const nights = Math.max(1, Math.round((params.checkOut - params.checkIn) / 86400000));
  const out: HotelOffer[] = [];
  for (const entry of (json?.hotels ?? []).slice(0, 12)) {
    try {
      const h = entry?.hotel;
      const rate = entry?.rateDetails;
      if (!h?.hotelName || !rate?.averageNightlyRate) continue;
      const roomRate = entry?.rooms?.[0]?.ratePlans?.[0]?.rateDetails;
      const cancelPenalty = roomRate?.cancelPenalties?.[0];
      const nightlyCents = Math.round(rate.averageNightlyRate * 100);
      const totalCents = rate.approxTotalPrice ? Math.round(rate.approxTotalPrice * 100) : nightlyCents * nights;
      out.push({
        id: `sabre-${h.hotelCode}`,
        source: 'sabre',
        name: h.hotelName,
        // Sabre's hotel record has no distinct "neighborhood" field — city
        // name is the closest honest label available.
        neighborhood: h.address?.cityName || params.city,
        address: [h.address?.addressLine1, h.address?.cityName].filter(Boolean).join(', '),
        checkIn: params.checkIn,
        checkOut: params.checkOut,
        nights,
        nightlyCents,
        totalCents,
        // No star rating in this response — 0 is falsy, so the UI's `rating ?
        // ... : null` guard cleanly hides the row instead of showing a made-up
        // number.
        rating: 0,
        cancellable: cancelPenalty ? !!cancelPenalty.refundable : false,
        raw: entry,
      });
    } catch {
      continue;
    }
  }
  return out;
}

// Mandatory pre-booking revalidation. For simulated offers there is nothing to
// re-price; the real path would re-shop the offer id and detect fare drift.
export async function revalidateFlight(
  offer: FlightOffer,
): Promise<{ offer: FlightOffer; changed: boolean }> {
  return { offer, changed: false };
}

export async function bookFlight(offer: FlightOffer): Promise<{ bookingRef: string; costCents: number }> {
  // Cert-environment or simulated: no real money moves. Produce a realistic PNR.
  return { bookingRef: shortCode(6), costCents: offer.priceCents };
}

export async function bookHotel(offer: HotelOffer): Promise<{ bookingRef: string; costCents: number }> {
  return { bookingRef: shortCode(6), costCents: offer.totalCents };
}
