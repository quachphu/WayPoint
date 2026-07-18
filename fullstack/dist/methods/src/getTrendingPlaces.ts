import { auth, mindstudio } from '@mindstudio-ai/agent';
import { CityPlaces, type TrendingPlace } from './tables/cityPlaces';
import { Users } from './tables/users';

// A lightly-visited cell waits a full week before rechecking for new spots;
// the clock tightens the more traffic a cell sees (see rescanIntervalFor),
// down to this floor so a viral area can't trigger nonstop rescanning.
const BASE_RESCAN_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_RESCAN_MS = 6 * 60 * 60 * 1000;

function rescanIntervalFor(visitCount: number): number {
  const scaled = BASE_RESCAN_MS / Math.max(1, Math.log2(visitCount + 2));
  return Math.max(MIN_RESCAN_MS, scaled);
}

// ~0.1° is roughly a 6-9 mile cell (exact size varies with latitude) — a
// physical location always rounds to the same cell regardless of which
// label a reverse-geocoder happens to report for it ("Lake Mary" one call,
// "Orlando" the next), so the shared cache is tied to where people actually
// are, not to inconsistent city-name strings.
const GRID_STEP = 0.1;

function gridKeyFor(lat: number, lng: number): string {
  const glat = (Math.round(lat / GRID_STEP) * GRID_STEP).toFixed(1);
  const glng = (Math.round(lng / GRID_STEP) * GRID_STEP).toFixed(1);
  return `${glat},${glng}`;
}

// Some geocoders return formal UN/ISO country names like "United States of
// America (the)" — left as-is this breaks every Nominatim geocode query
// built from it (silently returns zero matches), so every "trending places"
// scan for that country came back empty. Normalized here too, defensively,
// since a user's already-saved profile can still carry the unnormalized
// value even after the client-side fix (see src/lib/geo.ts).
function normalizeCountry(name?: string): string | undefined {
  return name?.replace(/\s*\(the\)\s*$/i, '').trim() || undefined;
}

function safeParseList(text: string): any[] {
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : Array.isArray(parsed?.places) ? parsed.places : [];
  } catch {
    const m = text.match(/\[[\s\S]*\]/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        return [];
      }
    }
    return [];
  }
}

// Real-world coordinates for each recommended place — Grok can name real
// spots but can't reliably give accurate lat/lng from memory, so every name
// gets looked up for real via Nominatim (OpenStreetMap's free geocoder).
async function geocode(placeName: string, areaLabel: string): Promise<{ lat: number; lng: number } | null> {
  const q = encodeURIComponent(`${placeName}, ${areaLabel}`);
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`, {
      headers: { 'User-Agent': 'WaypointHackathonApp/1.0 (DeepLearning.AI Voice AI Hackathon project)' },
    });
    if (!res.ok) {
      console.error(`[trending] geocode HTTP ${res.status} for "${placeName}, ${areaLabel}"`);
      return null;
    }
    const rows = await res.json();
    const hit = rows?.[0];
    if (!hit) {
      console.error(`[trending] geocode: no match for "${placeName}, ${areaLabel}"`);
      return null;
    }
    return { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon) };
  } catch (err) {
    console.error(`[trending] geocode failed for "${placeName}":`, err);
    return null;
  }
}

export async function getTrendingPlaces(rawInput: { city?: string; region?: string; country?: string; lat?: number; lng?: number }) {
  const userId = auth.userId;
  if (!userId) throw new Error('Please sign in.');
  if (rawInput.lat == null || rawInput.lng == null) return { places: [] as TrendingPlace[], scanned: false };

  const input = { ...rawInput, country: normalizeCountry(rawInput.country) };
  const key = gridKeyFor(input.lat, input.lng);
  const areaLabel = [input.city, input.region, input.country].filter(Boolean).join(', ') || `${input.lat.toFixed(2)}, ${input.lng.toFixed(2)}`;

  const existing = await CityPlaces.get(key);
  const visitCount = (existing?.visitCount ?? 0) + 1;

  if (existing && Date.now() - existing.lastScannedAt < rescanIntervalFor(existing.visitCount)) {
    // Bump the visit counter even on a cache hit — a busy cell's rescan
    // clock keeps tightening between actual scans, not just after them.
    await CityPlaces.update(key, { visitCount });
    return { places: existing.places, scanned: false, freshlyScanned: false };
  }

  const knownNames = existing?.places.map((p) => p.name) ?? [];
  // A row can exist with an empty places array (e.g. a prior scan genuinely
  // found nothing) — that should still get the broad "find 15-20" prompt,
  // not the narrower "find anything else" one meant for a cell that already
  // has real results to build on.
  const hasKnownPlaces = knownNames.length > 0;

  // Pull the requesting traveler's hobbies to bias what Grok searches for —
  // this is what actually broadens the pool beyond a handful of generic
  // "trending" spots. The result still merges into the one shared cache for
  // this grid cell, so other visitors' hobbies keep diversifying it too.
  const me = await Users.get(userId);
  const hobbies = me?.hobbies ?? [];
  const hobbiesClause = hobbies.length
    ? ` This visitor is into: ${hobbies.join(', ')}. Weight the search toward restaurants, cafes, and activities that genuinely match those interests (e.g. specific cuisines, sports bars, hiking/outdoors spots, gaming lounges, live music venues) whenever a real match exists nearby, alongside the general well-known local favorites — don't force a match that isn't real.`
    : '';

  const jsonSpec =
    'Return ONLY a raw JSON array with no citation markers, footnotes, or markdown links embedded anywhere in the text: ' +
    '[{"name":"...","category":"restaurant|cafe|attraction|shop|activity","blurb":"one short sentence on why it\'s worth visiting, noting if it\'s currently trending online"}]. ' +
    'No prose, no markdown fences, no citations in the JSON strings.';

  // Framed broadly on purpose: a corporate/office-park area rarely has
  // anything "trending" on social media right at its doorstep, but it almost
  // always has real, well-reviewed lunch spots, coffee shops, and things to
  // do within a few miles — that's the gap that was leaving these areas
  // looking empty. Search breadth (Google/Maps reviews, Reddit, Yelp-style
  // recommendations, not just social trending) and a wider radius both help.
  const sourceGuidance =
    "Pull from anywhere genuinely useful — Google Maps/Search reviews and ratings, Reddit threads, Yelp-style local recommendations, and X/Twitter/Instagram — not just what's currently trending on social media. If this is a business park, office district, or otherwise quiet area, that's expected: focus on the real, well-reviewed everyday spots people who work or live nearby actually go to (lunch spots, coffee, gyms, quick errands, casual dinner spots), not just tourist attractions.";

  const prompt = hasKnownPlaces
    ? `You previously found these local spots near ${areaLabel}: ${knownNames.join('; ')}. Search for any OTHER real, well-reviewed places (restaurants, cafes, attractions, shops, things to do) within about 5 miles of ${areaLabel} that are NOT in that list. ${sourceGuidance}${hobbiesClause} Only include real, currently-operating places you're confident exist. If there's genuinely nothing new nearby, return an empty array. ${jsonSpec}`
    : `Search for 15 to 20 real, well-reviewed local spots within about 5 miles of ${areaLabel} — restaurants, cafes, attractions, shops, and things to do. ${sourceGuidance}${hobbiesClause} Only include real, currently-operating places you're confident exist. ${jsonSpec}`;

  let candidates: { name: string; category?: string; blurb?: string }[] = [];
  try {
    const { content } = await mindstudio.generateWithSearch({ message: prompt, maxOutputTokens: 3000 });
    candidates = safeParseList(content);
    if (candidates.length === 0) console.error(`[trending] no candidates parsed from response:`, content?.slice(0, 500));
  } catch (err) {
    console.error('[trending] Grok search lookup failed:', err);
  }

  // Sequential, not parallel — Nominatim's usage policy caps requests at ~1/sec.
  const found: TrendingPlace[] = [];
  for (const c of candidates) {
    if (!c?.name || knownNames.includes(c.name)) continue;
    const point = await geocode(c.name, areaLabel);
    if (point) {
      found.push({
        name: c.name,
        category: (['restaurant', 'cafe', 'attraction', 'shop', 'activity'] as const).includes(c.category as any)
          ? (c.category as TrendingPlace['category'])
          : 'activity',
        blurb: c.blurb || '',
        ...point,
      });
    }
    await new Promise((r) => setTimeout(r, 1100));
  }

  const merged = [...(existing?.places ?? []), ...found];
  await CityPlaces.push({
    id: key,
    gridKey: key,
    city: input.city || areaLabel,
    region: input.region,
    country: input.country,
    places: merged,
    lastScannedAt: Date.now(),
    visitCount,
  } as any);

  return { places: merged, scanned: true, freshlyScanned: true, added: found.length };
}
