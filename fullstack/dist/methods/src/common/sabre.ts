import type { FlightOffer, HotelOffer } from './types';
import {
  simulateFlights,
  simulateHotels,
  shortCode,
  type FlightSearchParams,
  type HotelSearchParams,
} from './simulate';

// Sabre client. Attempts the real certification environment when credentials
// allow, and transparently falls back to simulated inventory (identical shape)
// on ANY error so the experience always completes. Every fallback is logged with
// the real reason via console.error.

const BASE =
  process.env.SABRE_ENV === 'prod'
    ? 'https://api.platform.sabre.com'
    : 'https://api.cert.platform.sabre.com';

function sabreConfigured(): boolean {
  // Bargain Finder Max requires a PseudoCityCode in the POS block. Without one,
  // real calls 400/403, so we go straight to simulated inventory.
  return !!process.env.SABRE_TOKEN && !!process.env.SABRE_PCC;
}

async function sabreFetch(path: string, init: RequestInit): Promise<any> {
  const token = process.env.SABRE_TOKEN;
  if (!token) throw new Error('SABRE_TOKEN not set');
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init.headers || {}),
    },
  });
  // fetch does not throw on non-2xx — check res.ok ourselves.
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Sabre ${res.status}: ${body.slice(0, 240)}`);
  }
  return res.json();
}

export async function searchFlights(
  params: FlightSearchParams,
): Promise<{ offers: FlightOffer[]; source: 'sabre' | 'simulated' }> {
  try {
    if (!sabreConfigured()) throw new Error('SABRE_PCC not configured; using simulated inventory');
    const pcc = process.env.SABRE_PCC!;
    const departISO = new Date(params.departDate).toISOString().slice(0, 10);
    const body = {
      OTA_AirLowFareSearchRQ: {
        Version: '5',
        POS: { Source: [{ PseudoCityCode: pcc, RequestorID: { Type: '1', ID: '1', CompanyName: { Code: 'TN' } } }] },
        OriginDestinationInformation: [
          {
            RPH: '1',
            DepartureDateTime: `${departISO}T00:00:00`,
            OriginLocation: { LocationCode: params.origin },
            DestinationLocation: { LocationCode: params.destination },
          },
        ],
        TravelPreferences: { TPA_Extensions: { NumTrips: { Number: 12 } } },
        TravelerInfoSummary: {
          SeatsRequested: [1],
          AirTravelerAvail: [{ PassengerTypeQuantity: [{ Code: 'ADT', Quantity: 1 }] }],
        },
      },
    };
    const json = await sabreFetch('/v5/offers/shop', { method: 'POST', body: JSON.stringify(body) });
    const offers = parseFlightResponse(json, params);
    if (!offers.length) throw new Error('Sabre returned no itineraries');
    return { offers, source: 'sabre' };
  } catch (err: any) {
    console.error('[sabre] flight search fell back to simulated:', err?.message || err);
    return { offers: simulateFlights(params), source: 'simulated' };
  }
}

// Best-effort parse of a BFM response into our normalized shape. Guarded — any
// shape surprise throws and triggers the simulated fallback above.
function parseFlightResponse(json: any, params: FlightSearchParams): FlightOffer[] {
  const itineraries =
    json?.groupedItineraryResponse?.itineraryGroups?.[0]?.itineraries ?? [];
  const legDescs = json?.groupedItineraryResponse?.legDescs ?? [];
  const legById = new Map<number, any>(legDescs.map((l: any) => [l.id, l]));
  const out: FlightOffer[] = [];
  for (const it of itineraries.slice(0, 12)) {
    const pricing = it?.pricingInformation?.[0]?.fare;
    const leg = legById.get(it?.legs?.[0]?.ref);
    const seg = leg?.schedules?.[0];
    if (!pricing || !seg) continue;
    const departAt = new Date(seg?.departure?.time || params.departDate).getTime();
    const arriveAt = new Date(seg?.arrival?.time || departAt).getTime();
    out.push({
      id: `sabre-${shortCode(6)}`,
      source: 'sabre',
      carrier: seg?.carrier?.marketing || 'Airline',
      carrierCode: seg?.carrier?.marketing || 'XX',
      flightNumber: `${seg?.carrier?.marketing || ''}${seg?.carrier?.marketingFlightNumber || ''}`,
      origin: params.origin,
      destination: params.destination,
      departAt,
      arriveAt,
      durationMin: Math.max(1, Math.round((arriveAt - departAt) / 60000)),
      stops: Math.max(0, (leg?.schedules?.length || 1) - 1),
      priceCents: Math.round((pricing?.totalFare?.totalPrice || 0) * 100),
      fareBrand: 'Published',
      cabin: 'economy',
      ttl: Date.now() + 20 * 60 * 1000,
      raw: it,
    });
  }
  return out;
}

export async function searchHotels(
  params: HotelSearchParams,
): Promise<{ offers: HotelOffer[]; source: 'sabre' | 'simulated' }> {
  try {
    if (!sabreConfigured()) throw new Error('SABRE_PCC not configured; using simulated inventory');
    // Content Services for Lodging availability would go here; without a PCC we
    // never reach it in cert, so fall through to simulated.
    throw new Error('hotel search not enabled without PCC');
  } catch (err: any) {
    console.error('[sabre] hotel search fell back to simulated:', err?.message || err);
    return { offers: simulateHotels(params), source: 'simulated' };
  }
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
