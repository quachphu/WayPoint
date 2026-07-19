// Real "how do I get from A to B" for board edges, computed for free: geocode
// both ends (Nominatim) then route between them (OSRM's public demo server —
// no key required). Falls back to the old heuristic guess on any failure
// (unresolvable place, network error, timeout) so an edge is never blocked.
import type { EdgeMode, TripNode } from './types';
import { geocode, haversineKm } from './geocode';
import { durationLabel } from './format';

const OSRM_BASE = 'https://router.project-osrm.org/route/v1';
const WALK_THRESHOLD_KM = 1.3;
const LONG_HOP_KM = 80;

interface TransitResult {
  mode: EdgeMode;
  label: string;
  durationMin?: number;
  distanceKm?: number;
}

// A search string good enough for a free geocoder to resolve each node kind to
// a real point on the map.
function placeQuery(n: TripNode): string {
  if (n.kind === 'flight') return `${n.location} airport`;
  const d = n.detail || {};
  if (n.kind === 'hotel') return d.address || `${n.title}, ${d.neighborhood || n.location}`;
  return `${n.title}, ${n.location}`;
}

async function route(mode: 'walking' | 'driving', from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const url = `${OSRM_BASE}/${mode}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const json = await res.json();
    const r = json?.routes?.[0];
    if (!r) return null;
    return { durationMin: Math.round(r.duration / 60), distanceKm: r.distance / 1000 };
  } catch (err) {
    console.error(`[transit] OSRM ${mode} route failed:`, err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Falls back to the previous static heuristic — kept identical so behavior
// degrades gracefully when geocoding/routing is unavailable (offline, rate
// limited, or the place just can't be resolved).
function heuristic(prev: TripNode, next: TripNode): TransitResult {
  if (next.kind === 'flight') {
    const min = next.detail?.durationMin;
    return { mode: 'flight', label: min ? `${durationLabel(min)} flight` : 'flight' };
  }
  if (next.kind === 'activity' && prev.kind === 'activity') return { mode: 'walk', label: '12 min walk' };
  if (prev.kind === 'flight' && next.kind === 'hotel') return { mode: 'drive', label: '20 min drive' };
  if (next.kind === 'activity') return { mode: 'walk', label: '15 min walk' };
  return { mode: 'drive', label: '20 min drive' };
}

export async function estimateTransit(prev: TripNode, next: TripNode): Promise<TransitResult> {
  // Flights already carry an authoritative duration from the offer — no need
  // to route, and geocoding an in-air leg makes no sense.
  if (next.kind === 'flight') return heuristic(prev, next);

  try {
    const [a, b] = await Promise.all([geocode(placeQuery(prev)), geocode(placeQuery(next))]);
    if (!a || !b) return heuristic(prev, next);

    const straightLine = haversineKm(a, b);
    const walking = straightLine <= WALK_THRESHOLD_KM;
    const routed = await route(walking ? 'walking' : 'driving', a, b);
    if (!routed) return heuristic(prev, next);

    const mode: EdgeMode = walking ? 'walk' : 'drive';
    let label = `${durationLabel(routed.durationMin)} ${walking ? 'walk' : 'drive'}`;
    if (!walking && routed.distanceKm > LONG_HOP_KM) {
      label += ' · consider a train or shuttle for this distance';
    }
    return { mode, label, durationMin: routed.durationMin, distanceKm: Math.round(routed.distanceKm * 10) / 10 };
  } catch (err) {
    console.error('[transit] estimate failed, using heuristic:', err);
    return heuristic(prev, next);
  }
}
