// Free, keyless geocoding (OpenStreetMap Nominatim) shared by transit and
// trending-places lookups. Nominatim's usage policy caps requests at ~1/sec,
// so every call is serialized through one queue and results are cached for
// the life of the process — the same airport/hotel/activity label gets
// looked up many times across a trip's turns.

interface LatLng {
  lat: number;
  lng: number;
}

const cache = new Map<string, LatLng | null>();
let lastCallAt = 0;
const MIN_GAP_MS = 1100;
let queue: Promise<any> = Promise.resolve();

async function throttle<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = MIN_GAP_MS - (Date.now() - lastCallAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCallAt = Date.now();
    return fn();
  });
  // Keep the queue alive even if this call fails, so later callers aren't stuck.
  queue = run.catch(() => undefined);
  return run;
}

export async function geocode(label: string): Promise<LatLng | null> {
  const key = label.trim().toLowerCase();
  if (!key) return null;
  if (cache.has(key)) return cache.get(key)!;

  const result = await throttle(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(label)}&format=json&limit=1`, {
        headers: { 'User-Agent': 'WaypointHackathonApp/1.0 (DeepLearning.AI Voice AI Hackathon project)' },
        signal: controller.signal,
      });
      if (!res.ok) return null;
      const rows = await res.json();
      const hit = rows?.[0];
      if (!hit) return null;
      return { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon) };
    } catch (err) {
      console.error(`[geocode] lookup failed for "${label}":`, err);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  });

  cache.set(key, result);
  return result;
}

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}
