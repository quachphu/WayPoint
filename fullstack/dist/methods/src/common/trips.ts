import { db, mindstudio } from '@mindstudio-ai/agent';
import { Trips } from '../tables/trips';
import { Messages } from '../tables/messages';
import { PendingActions } from '../tables/pendingActions';
import { CallSessions } from '../tables/callSessions';
import { recordEvents } from './tripState';
import { ensureOwnerRow, buildRoster } from './collaborators';
import { activeExpensesForTrip } from './expenses';

function safeParse(text: string): any | null {
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    return m ? (() => { try { return JSON.parse(m[0]); } catch { return null; } })() : null;
  }
}

function parseWhen(v: any): number | null {
  if (v == null || v === '') return null;
  const t = Date.parse(String(v));
  return isNaN(t) ? null : t;
}

// Scenarios seed trips under this placeholder owner. The first authenticated
// traveler to open the app claims them (see getBootstrap), which decouples seed
// data from platform-managed auth identities.
export const DEMO_OWNER = 'demo-seed';

export interface TripMeta {
  title: string;
  destination: string;
  origin?: string;
  startDate: number | null;
  endDate: number | null;
}

// Extract a trip name, destination, and dates from the first utterance so the
// board's title bar has something real immediately.
export async function extractTripMeta(text: string): Promise<TripMeta> {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const { content } = await mindstudio.generateText({
      message: `Extract trip details from a traveler's request. Today is ${today}. Request: "${text}". Return JSON {"title","destination","originAirport","startDate","endDate"}. title is a short human trip name like "Weekend in San Francisco". destination is the city. originAirport is a 3-letter IATA code only if the traveler said where they are leaving from, else "". startDate and endDate are ISO dates (YYYY-MM-DD) if inferable (e.g. "this weekend"), else "". No commentary.`,
      modelOverride: { model: 'gemini-3-flash', temperature: 0.2, maxResponseTokens: 2000 },
      structuredOutputType: 'json',
      structuredOutputExample: '{"title":"Weekend in San Francisco","destination":"San Francisco","originAirport":"","startDate":"2026-03-14","endDate":"2026-03-16"}',
    } as any);
    const p = safeParse(content) || {};
    return {
      title: p.title || 'New trip',
      destination: p.destination || '',
      origin: p.originAirport || undefined,
      startDate: parseWhen(p.startDate),
      endDate: parseWhen(p.endDate),
    };
  } catch (err) {
    console.error('[trips] extractTripMeta failed:', err);
    return { title: 'New trip', destination: '', origin: undefined, startDate: null, endDate: null };
  }
}

// Mid-conversation on one trip, the traveler names a clearly different
// destination — "plan a Spain trip for Feb 10-20..." while inside a Seattle
// trip's chat. Without this check, converse.ts hands that straight to the
// orchestrator INSIDE the open trip's context, and the model (reasonably,
// given no guidance either way) tends to ask "are we switching?" instead of
// just doing it — confusing, since the traveler never touched "new trip."
// Defaults to false (stay on the current trip) on any failure or ambiguity —
// never surprise-create a trip on a flaky classification call.
export async function isDifferentTripRequest(text: string, currentTrip: { title: string; destination: string }): Promise<boolean> {
  if (!currentTrip.destination || text.trim().length < 15) return false;
  try {
    const { content } = await mindstudio.generateText({
      message: `The traveler is mid-conversation about a trip to ${currentTrip.destination} ("${currentTrip.title}"). They just said: "${text}"

Does this describe planning a DIFFERENT, separate trip — a different destination, clearly not about modifying, continuing, or asking about the ${currentTrip.destination} trip? Say false if it's about continuing/adjusting the ${currentTrip.destination} trip, if it's ambiguous, or if no specific different destination is actually named.

Return JSON {"differentTrip": boolean}.`,
      modelOverride: { model: 'gemini-3-flash', temperature: 0, maxResponseTokens: 100 },
      structuredOutputType: 'json',
      structuredOutputExample: '{"differentTrip":false}',
    } as any);
    return !!safeParse(content)?.differentTrip;
  } catch (err) {
    console.error('[trips] isDifferentTripRequest failed:', err);
    return false;
  }
}

// Turns whatever the traveler answered "what should we call this trip?"
// with into a short, fun name carrying exactly one relevant emoji — so a
// two-word throwaway answer ("Seattle trip", "idk you pick") still comes
// back feeling like something worth naming a folder after, not a repeat of
// the mechanical "X to Y Trip" auto-title. Falls back to the raw answer
// (lightly title-cased, one generic emoji) if the model call fails, so
// naming never blocks the trip from proceeding.
export async function funnifyTripName(rawName: string, destination?: string): Promise<string> {
  const cleaned = rawName.trim().slice(0, 120);
  try {
    const { content } = await mindstudio.generateText({
      message: `A traveler was asked "what should we call this trip?" and answered: "${cleaned}"${destination ? ` (the trip is to ${destination})` : ''}. Turn that into a short, fun trip name (2-5 words) carrying exactly ONE relevant emoji. Keep any specific place/theme they mentioned. If their answer is a real, already-fun name, keep it close to what they said — just add the emoji and light polish, don't replace their idea. Return ONLY the name, no quotes, no commentary.`,
      modelOverride: { model: 'gemini-3-flash', temperature: 0.8, maxResponseTokens: 60 },
    } as any);
    const name = (content || '').trim().replace(/^["']|["']$/g, '');
    return name || cleaned;
  } catch (err) {
    console.error('[trips] funnifyTripName failed:', err);
    return cleaned ? `${cleaned} ✨` : 'Our Trip ✨';
  }
}

export async function createTripForUser(userId: string, meta: TripMeta) {
  const trip = await Trips.push({
    userId,
    // The extracted title is a working fallback only — real board/UI use is
    // fine with it in the meantime, but it gets replaced by a fun,
    // traveler-approved name once they answer the naming question below.
    title: meta.title || 'New trip',
    destination: meta.destination || '',
    origin: meta.origin,
    startDate: meta.startDate ?? null,
    endDate: meta.endDate ?? null,
    status: 'planning',
    nodes: [],
    edges: [],
    version: 0,
    namePending: true,
  });
  await recordEvents(trip.id, userId, [
    { kind: 'trip_created', payload: { title: trip.title, destination: trip.destination } },
  ]);
  // Every trip gets an owner collaborator row so sharing works from the start.
  await ensureOwnerRow(trip.id, userId);
  return (await Trips.get(trip.id))!;
}

export function tripSummary(t: any) {
  return {
    id: t.id,
    title: t.title,
    destination: t.destination,
    startDate: t.startDate,
    endDate: t.endDate,
    status: t.status,
    version: t.version,
    nodeCount: (t.nodes || []).length,
    updatedAt: t.updated_at,
  };
}

// Everything a single trip's UI needs, in one round trip.
export async function getTripBundle(tripId: string) {
  const [trip, messages, pendingActions, calls] = await db.batch(
    Trips.get(tripId),
    Messages.filter((m, $) => m.tripId === $.tripId, { tripId }).sortBy((m) => m.created_at), // bindings: lifts closure var so filter compiles to SQL
    PendingActions.filter((p, $) => p.tripId === $.tripId && p.status === 'pending', { tripId }), // bindings: lifts closure var so filter compiles to SQL
    CallSessions.filter((c, $) => c.tripId === $.tripId, { tripId }).sortBy((c) => c.created_at), // bindings: lifts closure var so filter compiles to SQL
  );
  const activeCall = calls.length ? calls[calls.length - 1] : null;
  // Kept out of the batch above: trip_expenses is a newer table that may not
  // exist yet on a project that hasn't re-run the README's storage setup
  // SQL, and activeExpensesForTrip is already self-defensive about that —
  // a missing table here must never take down the rest of an otherwise-
  // healthy trip bundle the way a single failed Promise.all member would.
  const expenses = await activeExpensesForTrip(tripId);
  return { trip, messages, pendingActions, activeCall, expenses };
}
