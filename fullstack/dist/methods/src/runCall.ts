import { auth, mindstudio, stream } from '@mindstudio-ai/agent';
import { Trips } from './tables/trips';
import { CallSessions, type CallTurn } from './tables/callSessions';
import { PendingActions } from './tables/pendingActions';
import { recordEvents } from './common/tripState';
import { assertTripAccess } from './common/collaborators';
import { weekdayShort, timeOfDay, moneyShort } from './common/format';
import type { FlightOffer } from './common/types';

const CALL_MODEL = 'gemini-3-flash';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// The flagship. Runs the streamed, AI-driven simulated call: hardcoded disclosure
// first, then a bounded beat script, each line generated turn by turn and streamed
// so it reads as live. Produces a REBOOK proposal (gated) — never a rebooking.
export async function runCall(input: { tripId: string; callSessionId: string }) {
  const userId = auth.userId;
  if (!userId) throw new Error('Please sign in.');
  const call = await CallSessions.get(input.callSessionId);
  if (!call) throw new Error('Call not found.');
  // Anyone on the trip can watch the call run; the rebook still gates on approval.
  const access = await assertTripAccess(call.tripId, userId);
  const trip = access.trip;
  if (call.status === 'ended') return { ok: true, outcome: call.outcome, callSessionId: call.id };

  const ctx = call.context || {};
  const alternatives: FlightOffer[] = ctx.alternatives || [];
  const carrier: string = ctx.carrier || 'the airline';
  const route = ctx.route || { origin: '', destination: '' };
  const originalOffer: FlightOffer | undefined = ctx.originalOffer;
  const nodeId: string = ctx.nodeId || call.nodeId;
  const chosen = alternatives[0];

  const transcript: CallTurn[] = [];
  const emit = async (speaker: 'waypoint' | 'venue', text: string, subStatus: string) => {
    const turn: CallTurn = { speaker, text, at: Date.now() };
    transcript.push(turn);
    await CallSessions.update(call.id, { transcript, subStatus, status: 'in_progress' });
    await stream({ type: 'call_turn', turn, subStatus, callSessionId: call.id });
    await sleep(750);
  };

  // Node goes "working" for the duration of the call, and we log the call start.
  if (nodeId) {
    await recordEvents(trip.id, 'agent:disruption', [
      { kind: 'node_working_started', payload: { nodeId } },
      { kind: 'call_started', payload: { callSessionId: call.id, target: call.target } },
    ]);
    const t = await Trips.get(trip.id);
    const n = t?.nodes.find((x) => x.id === nodeId);
    if (n) await stream({ type: 'node', op: 'update', node: n });
  }

  await CallSessions.update(call.id, { status: 'connected', subStatus: 'Connecting' });
  await stream({ type: 'call_status', status: 'connected', subStatus: 'Connecting', callSessionId: call.id });
  await sleep(600);

  // Turn 1: the hardcoded disclosure — never model-generated.
  await emit('waypoint', call.disclosureLine, 'Explaining the situation');

  const confCode = genCode();
  const facts = {
    delayedFlight: originalOffer
      ? `${carrier} ${originalOffer.flightNumber} from ${route.origin} to ${route.destination}`
      : `${carrier} flight from ${route.origin} to ${route.destination}`,
    availableOptions: alternatives.slice(0, 2).map((o) => ({
      flightNumber: o.flightNumber,
      depart: `${weekdayShort(o.departAt)} ${timeOfDay(o.departAt)}`,
      arrive: timeOfDay(o.arriveAt),
      fareVsOriginal: fareDelta(chosen, originalOffer).label,
      stops: o.stops,
    })),
    confirmationCode: confCode,
  };

  const beats: { speaker: 'waypoint' | 'venue'; sub: string; instr: string }[] = [
    { speaker: 'waypoint', sub: 'Explaining the situation', instr: `Explain you are calling to rebook the traveler's delayed flight (${facts.delayedFlight}) and ask for the earliest good option.` },
    { speaker: 'venue', sub: 'Getting options', instr: `Offer the FIRST option in AVAILABLE_OPTIONS only. State its flight number, departure day and time, arrival time, and whether the fare is the same. Do not offer anything not listed.` },
    { speaker: 'waypoint', sub: 'Confirming the option', instr: `Confirm you would like that option and ask them to make the change.` },
    { speaker: 'venue', sub: 'Locking it in', instr: `Confirm the change is done, read back the new flight, and give confirmation code ${confCode}.` },
    { speaker: 'waypoint', sub: 'Wrapping up', instr: `Thank them briefly and say goodbye.` },
  ];

  for (const beat of beats) {
    const line = await genLine(beat.speaker, beat.instr, transcript, facts, carrier);
    await emit(beat.speaker, line, beat.sub);
  }

  const outcome = chosen
    ? `${carrier} ${chosen.flightNumber} confirmed, departs ${weekdayShort(chosen.departAt)} ${timeOfDay(chosen.departAt)}, ${fareDelta(chosen, originalOffer).label}.`
    : 'No suitable alternative was available on this call.';

  // End the call: stop the node spinner and log the outcome.
  const endEvents: { kind: string; payload: any }[] = [{ kind: 'call_ended', payload: { callSessionId: call.id, outcome } }];
  if (nodeId) endEvents.unshift({ kind: 'node_working_ended', payload: { nodeId } });
  await recordEvents(trip.id, 'agent:disruption', endEvents);
  await CallSessions.update(call.id, { status: 'ended', subStatus: 'Call ended', outcome, endedAt: Date.now() });
  await stream({ type: 'call_status', status: 'ended', subStatus: 'Call ended', outcome, callSessionId: call.id });

  if (nodeId) {
    const t = await Trips.get(trip.id);
    const n = t?.nodes.find((x) => x.id === nodeId);
    if (n) await stream({ type: 'node', op: 'update', node: n });
  }

  // Produce a REBOOK proposal behind the gate. Nothing rebooks here.
  let action = null;
  if (chosen) {
    const delta = fareDelta(chosen, originalOffer);
    // Sanity check: an unusual fare gets flagged for extra scrutiny, never auto-applied.
    const sane = !originalOffer || chosen.priceCents <= originalOffer.priceCents * 3 + 20000;
    const deltaNote = delta.cents > 0 ? ` (+${moneyShort(delta.cents)})` : delta.cents < 0 ? ` (${moneyShort(Math.abs(delta.cents))} less)` : ' (same fare)';
    const summary = `Rebook onto ${carrier} ${chosen.flightNumber}, ${weekdayShort(chosen.departAt)} ${timeOfDay(chosen.departAt)}${deltaNote}${sane ? '' : ' — please review, the fare looks unusual'}`;
    action = await PendingActions.push({
      tripId: trip.id,
      nodeId,
      kind: 'rebook',
      summary,
      payload: { nodeId, newOffer: chosen, fareDeltaCents: delta.cents, confirmationCode: confCode },
      status: 'pending',
      resolvedAt: null,
    });
    await stream({ type: 'gate', action });
  }

  const finalTrip = await Trips.get(trip.id);
  return { ok: true, outcome, callSessionId: call.id, actionId: action?.id ?? null, tripId: trip.id, version: finalTrip?.version ?? 0 };
}

function genCode(): string {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += c[Math.floor(Math.random() * c.length)];
  return s;
}

function fareDelta(o: FlightOffer | undefined, orig: FlightOffer | undefined): { cents: number; label: string } {
  if (!o || !orig) return { cents: 0, label: 'no fare change' };
  const d = o.priceCents - orig.priceCents;
  if (d === 0) return { cents: 0, label: 'same fare' };
  return d > 0 ? { cents: d, label: `${moneyShort(d)} more` } : { cents: d, label: `${moneyShort(Math.abs(d))} less` };
}

async function genLine(
  speaker: 'waypoint' | 'venue',
  instr: string,
  transcript: CallTurn[],
  facts: any,
  carrier: string,
): Promise<string> {
  const persona =
    speaker === 'waypoint'
      ? 'You are Waypoint, a calm, competent AI travel assistant on a phone call.'
      : `You are a professional ${carrier} reservations agent on a phone call. You may only reference facts in AVAILABLE_OPTIONS.`;
  const prompt = `${persona}
${instr}

FACTS (ground truth, never contradict):
${JSON.stringify(facts, null, 2)}

TRANSCRIPT SO FAR:
${transcript.map((t) => `${t.speaker === 'waypoint' ? 'Assistant' : carrier}: ${t.text}`).join('\n') || '(call just connected)'}

Output only the next spoken line for ${speaker === 'waypoint' ? 'the Assistant' : 'the ' + carrier + ' agent'}. One or two natural sentences. No speaker label, no quotes, no stage directions, no emojis, no em dashes.`;
  try {
    const { content } = await mindstudio.generateText({
      message: prompt,
      modelOverride: { model: CALL_MODEL, temperature: 0.6, maxResponseTokens: 4000 },
    } as any);
    return cleanLine(content);
  } catch (err) {
    console.error('[runCall] genLine failed:', err);
    return speaker === 'waypoint' ? 'Thanks, could you help me rebook this flight?' : 'Let me see what we have available for you.';
  }
}

function cleanLine(s: string): string {
  return (s || '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/^(Assistant|Agent|Waypoint|Rep|Representative|[A-Za-z ]+):\s*/i, '')
    .replace(/—/g, ', ')
    .trim();
}
