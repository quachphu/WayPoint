import { db, mindstudio } from '@mindstudio-ai/agent';
import { Trips } from '../tables/trips';
import { Messages } from '../tables/messages';
import { PendingActions } from '../tables/pendingActions';
import { CallSessions } from '../tables/callSessions';
import { recordEvents } from './tripState';
import { ensureOwnerRow, buildRoster } from './collaborators';

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

export async function createTripForUser(userId: string, meta: TripMeta) {
  const trip = await Trips.push({
    userId,
    title: meta.title || 'New trip',
    destination: meta.destination || '',
    origin: meta.origin,
    startDate: meta.startDate ?? null,
    endDate: meta.endDate ?? null,
    status: 'planning',
    nodes: [],
    edges: [],
    version: 0,
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
  return { trip, messages, pendingActions, activeCall };
}
