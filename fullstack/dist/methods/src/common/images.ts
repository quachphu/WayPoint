// Best-effort real photos for hotel/activity cards, free and keyless: search
// Wikipedia for the closest matching page, then read its summary thumbnail.
// Returns null on no-match or any failure — the UI falls back to a plain
// kind icon, so a bad or missing photo never blocks anything.

const cache = new Map<string, string | null>();

// Generic category words that show up in almost every query but tell you
// nothing about WHICH place it is — stripping them before checking overlap
// stops Wikipedia's fuzzy search from matching a same-category-but-wrong page
// (e.g. "The Buchanan hotel" fuzzy-matching a random, unrelated Hyatt) purely
// because both are "hotel". A confidently wrong photo is worse than no photo.
const GENERIC_WORDS = new Set([
  'hotel', 'inn', 'resort', 'restaurant', 'cafe', 'bar', 'lounge', 'trail', 'park',
  'museum', 'club', 'market', 'hall', 'center', 'centre', 'house', 'tour', 'activity',
  'the', 'and', 'san', 'los', 'new', 'saint',
]);

function significantWords(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 4 && !GENERIC_WORDS.has(w));
}

// Every caller builds queries as "<place name> <neighborhood/city>" (see
// agent.ts), so the first significant word is the most distinctive token of
// the actual name — everything after is just location context to help
// Wikipedia's search find the right region, not something to match literally.
// Checking the whole query (or even the first two words) let a small,
// Wikipedia-less business's query fall back to matching its *neighborhood's*
// own article instead (e.g. "The Buchanan Japantown" matching the general
// "Japantown" page) — technically "relevant" by a loose word-overlap check,
// but the photo on a neighborhood article is not a photo of that business, and
// can be a completely unrelated place that merely shares the concept (a
// same-named Japantown on another continent, in one observed case). Requiring
// the actual name token specifically is what catches that.
function isRelevantMatch(query: string, title: string): boolean {
  const [nameWord] = significantWords(query);
  if (!nameWord) return true; // nothing distinctive to check against; trust the search
  return title.toLowerCase().includes(nameWord);
}

async function fetchJson(url: string, timeoutMs = 3500): Promise<any | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'WaypointHackathonApp/1.0' } });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error(`[images] fetch failed for ${url}:`, err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function lookupImage(query: string): Promise<string | null> {
  const key = query.trim().toLowerCase();
  if (!key) return null;
  if (cache.has(key)) return cache.get(key)!;

  let result: string | null = null;
  try {
    const search = await fetchJson(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*&srlimit=1`,
    );
    const title = search?.query?.search?.[0]?.title;
    if (title && isRelevantMatch(query, title)) {
      const summary = await fetchJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
      result = summary?.thumbnail?.source || summary?.originalimage?.source || null;
    }
  } catch (err) {
    console.error(`[images] lookup failed for "${query}":`, err);
  }

  cache.set(key, result);
  return result;
}
