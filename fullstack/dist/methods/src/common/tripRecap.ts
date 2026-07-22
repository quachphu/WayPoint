import { mindstudio } from '@mindstudio-ai/agent';
import { Trips, type Trip } from '../tables/trips';
import { TripEvents } from '../tables/tripEvents';
import { TripRecaps } from '../tables/tripRecaps';
import { Users } from '../tables/users';
import { Messages } from '../tables/messages';
import { buildRoster, mintInviteToken } from './collaborators';
import type { TripNode } from './types';

// "A day or two after a trip's last node completes" — grace before a past
// end date locks a trip in as complete, giving any in-flight disruption
// handling room to resolve before the story is written.
const COMPLETION_GRACE_MS = 36 * 60 * 60 * 1000;

function safeParse(text: string): any | null {
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function nodesDigest(nodes: TripNode[]): string {
  const lines = nodes
    .filter((n) => n.status === 'confirmed' || n.status === 'disrupted')
    .map((n) => `- ${n.kind}: "${n.title}"${n.subtitle ? ` (${n.subtitle})` : ''}${n.location ? ` in ${n.location}` : ''}`);
  return lines.length ? lines.join('\n') : '(nothing confirmed)';
}

function disruptionDigest(events: { kind: string; payload: any }[]): string {
  const disrupted = events.filter((e) => e.kind === 'node_disrupted');
  if (!disrupted.length) return '(no disruptions)';
  const rebooked = events.filter((e) => e.kind === 'rebooked');
  return disrupted
    .map((e) => {
      const reason = e.payload?.detail?.delay?.reason || 'a delay';
      const rebook = rebooked.find((r) => r.payload?.nodeId === e.payload?.nodeId);
      const resolution = rebook?.payload?.patch?.subtitle || rebook?.payload?.patch?.title;
      return `- ${reason}.${resolution ? ` Rebooked onto ${resolution}.` : ''}`;
    })
    .join('\n');
}

async function generateRecapForTrip(trip: Trip & { id: string }): Promise<void> {
  const events = await TripEvents.filter(
    (e, $) => e.tripId === $.tripId,
    { tripId: trip.id }, // bindings: lifts closure var so filter compiles to SQL
  );
  const roster = await buildRoster(trip.id, trip.userId);
  const companions = roster
    .filter((m) => m.status === 'active')
    .map((m) => ({ name: m.displayName || 'A traveler', color: m.presenceColor }));
  const photoUrls = trip.nodes.filter((n) => n.imageUrl).map((n) => n.imageUrl as string).slice(0, 3);

  const dateRange =
    trip.startDate && trip.endDate ? `${new Date(trip.startDate).toDateString()} to ${new Date(trip.endDate).toDateString()}` : '';
  const prompt = `Trip: "${trip.title}" to ${trip.destination}${dateRange ? `, ${dateRange}` : ''}.

What happened:
${nodesDigest(trip.nodes)}

Disruptions:
${disruptionDigest(events)}

Write a short (3-5 sentence) warm, specific recap narrating this trip as a story, like telling a friend about it afterward — mention real names/places from the list above, never generic filler. If there were any disruptions, also write ONE short, punchy, specific sentence about how Waypoint handled it, grounded only in the actual reason/resolution above, never invented — the kind of line that sells the product to whoever reads it next ("Your flight got delayed three hours. Waypoint called the airline and got you on an earlier one instead." is the target tone). If there were no disruptions, disruptionLine must be null.

Return JSON {"narrative": string, "disruptionLine": string | null}.`;

  let narrative = `A trip to ${trip.destination}.`;
  let disruptionLine: string | null = null;
  try {
    const { content } = await mindstudio.generateText({
      message: prompt,
      modelOverride: { model: 'gemini-3-flash', temperature: 0.7, maxResponseTokens: 600 },
      structuredOutputType: 'json',
      structuredOutputExample: JSON.stringify({
        narrative: 'Three days chasing coffee shops and skyline views across Seattle, capped off with a rooftop dinner on the last night.',
        disruptionLine: null,
      }),
    } as any);
    const parsed = safeParse(content);
    if (parsed?.narrative) narrative = parsed.narrative;
    if (parsed?.disruptionLine) disruptionLine = parsed.disruptionLine;
  } catch (err) {
    console.error(`[tripRecap] narrative generation failed for trip ${trip.id}:`, err);
  }

  const shareToken = mintInviteToken();
  await TripRecaps.push({
    tripId: trip.id,
    shareToken,
    title: trip.title,
    destination: trip.destination,
    startDate: trip.startDate,
    endDate: trip.endDate,
    narrative,
    disruptionLine,
    companions,
    photoUrls,
    generatedAt: Date.now(),
  });

  // The only "send" channel that actually exists in this app — an in-app
  // system message, same honest delivery pattern already used for invites,
  // missed calls, etc. Every collaborator sees it next time they open the trip.
  await Messages.push({
    tripId: trip.id,
    role: 'agent',
    text: `Your trip wrapped up — I put together a recap worth sharing: /recap/${shareToken}`,
    source: 'system',
    status: 'complete',
  });
}

async function markCompletedTrips(): Promise<void> {
  const cutoff = Date.now() - COMPLETION_GRACE_MS;
  const candidates = await Trips.filter(
    (t) => t.status !== 'complete' && t.endDate != null && t.endDate < cutoff,
  );
  for (const t of candidates) {
    try {
      await Trips.update(t.id, { status: 'complete' });
    } catch (err) {
      console.error(`[tripRecap] failed to mark trip ${t.id} complete:`, err);
    }
  }
}

async function generateMissingRecaps(): Promise<void> {
  const completed = await Trips.filter((t) => t.status === 'complete');
  for (const trip of completed) {
    try {
      const existing = await TripRecaps.filter(
        (r, $) => r.tripId === $.tripId,
        { tripId: trip.id }, // bindings: lifts closure var so filter compiles to SQL
      );
      if (existing.length) continue;
      const owner = await Users.get(trip.userId);
      if (!owner?.recapOptIn) continue;
      await generateRecapForTrip(trip);
    } catch (err) {
      console.error(`[tripRecap] recap generation failed for trip ${trip.id}:`, err);
    }
  }
}

// Called on an interval (see backend/plugin.ts) — never throws past its own
// sweep; each trip's work is independently guarded so one bad trip can't
// block the rest.
export async function sweepTripsForRecap(): Promise<void> {
  await markCompletedTrips();
  await generateMissingRecaps();
}
