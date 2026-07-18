// Best-effort location detection, run once per sign-in so "people nearby"
// reflects where the traveler actually is. Browser Geolocation (precise,
// needs permission) first, reverse-geocoded to a city/region/country via a
// free keyless API; falls back to IP-based geolocation if permission is
// denied or unavailable. Never throws — a failed lookup just means no
// location gets saved this session.
export interface GeoResult {
  city?: string;
  region?: string;
  country?: string;
  lat?: number;
  lng?: number;
}

// Some geocoders (BigDataCloud included) return formal UN/ISO country names
// like "United States of America (the)" or "Netherlands (the)" instead of
// the common short form. Left as-is, that string ends up both displayed in
// the UI and appended to every Nominatim geocoding query — which silently
// fails to match against it, breaking the entire trending-places lookup for
// anyone in one of these countries.
function normalizeCountry(name: string | undefined): string | undefined {
  return name?.replace(/\s*\(the\)\s*$/i, '').trim() || undefined;
}

async function reverseGeocode(lat: number, lng: number): Promise<GeoResult> {
  const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`);
  if (!res.ok) throw new Error(`reverse geocode failed: ${res.status}`);
  const d = await res.json();
  return { city: d.city || d.locality || undefined, region: d.principalSubdivision || undefined, country: normalizeCountry(d.countryName), lat, lng };
}

async function ipGeolocatePrimary(): Promise<GeoResult> {
  const res = await fetch('https://ipapi.co/json/');
  if (!res.ok) throw new Error(`ipapi.co failed: ${res.status}`);
  const d = await res.json();
  if (d.error) throw new Error(String(d.reason || 'ipapi.co error'));
  return { city: d.city || undefined, region: d.region || undefined, country: normalizeCountry(d.country_name), lat: d.latitude, lng: d.longitude };
}

// Second IP-based fallback — ipapi.co is on some ad-blocker/privacy-extension
// block lists (it's a recognizable tracker-shaped hostname), so a single IP
// provider can silently fail for a chunk of real users. ipwho.is is a
// different host/shape and free/keyless like the first.
async function ipGeolocateSecondary(): Promise<GeoResult> {
  const res = await fetch('https://ipwho.is/');
  if (!res.ok) throw new Error(`ipwho.is failed: ${res.status}`);
  const d = await res.json();
  if (d.success === false) throw new Error(String(d.message || 'ipwho.is error'));
  return { city: d.city || undefined, region: d.region || undefined, country: normalizeCountry(d.country), lat: d.latitude, lng: d.longitude };
}

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('geolocation unsupported'));
    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000, maximumAge: 3600000 });
  });
}

export async function detectLocation(): Promise<GeoResult | null> {
  try {
    const pos = await getCurrentPosition();
    return await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
  } catch (err) {
    console.error('[geo] browser geolocation unavailable, falling back to IP:', err);
  }
  try {
    return await ipGeolocatePrimary();
  } catch (err) {
    console.error('[geo] primary IP geolocation failed, trying secondary:', err);
  }
  try {
    return await ipGeolocateSecondary();
  } catch (err) {
    console.error('[geo] secondary IP geolocation also failed:', err);
    return null;
  }
}
