import { stream } from '@mindstudio-ai/agent';
import { CallSessions, type CallTurn } from '../tables/callSessions';
import { Messages } from '../tables/messages';
import { recordEvents } from './tripState';
import { travelerDisclosureLine } from './callScript';
import { underDailyCallCap } from './callRateLimit';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// How long a call is allowed to sit "dialing" before it counts as unanswered —
// the honest analog of "let it ring." There is no way to reach a closed
// browser tab, so anyone not actively polling this trip within the window
// genuinely didn't pick up.
const RING_TIMEOUT_MS = 25_000;

// Places a "Waypoint calls you" session: opens ringing (status: 'dialing'),
// does not speak yet. The traveler answers (answerTravelerCall) or the
// sweep below times it out — either path ends in the exact same fallback
// message, so the call is always an escalation, never the only way the
// news arrives.
export async function placeTravelerCall(input: {
  tripId: string;
  nodeId: string;
  userId: string;
  situationLabel: string;
  message: string;
  carrier?: string;
  route?: { origin: string; destination: string };
}): Promise<{ callSessionId: string } | null> {
  if (!(await underDailyCallCap(input.userId))) {
    console.error(`[travelerCall] daily cap reached for user ${input.userId} — skipping proactive call`);
    return null;
  }

  const call = await CallSessions.push({
    tripId: input.tripId,
    nodeId: input.nodeId,
    kind: 'to_traveler',
    userId: input.userId,
    target: 'you',
    goal: 'Give the traveler a heads-up and offer to hop onto the board',
    disclosureLine: travelerDisclosureLine(input.situationLabel),
    status: 'dialing',
    subStatus: 'Ringing',
    transcript: [],
    outcome: null,
    consentBasis: 'Traveler consented to being called at signup (callConsent)',
    context: { situationLabel: input.situationLabel, message: input.message, carrier: input.carrier, route: input.route },
    startedAt: Date.now(),
    endedAt: null,
  });

  // A metadata-only event kind deriveTripState already no-ops on the board,
  // but recordEvents/refoldTrip unconditionally bumps trip.version — that's
  // what makes the EXISTING syncTrip poll (~4s, already running while a trip
  // is open) ship this call to any open tab, with no new polling infra.
  await recordEvents(input.tripId, 'agent:disruption', [
    { kind: 'call_started', payload: { callSessionId: call.id, target: 'you' } },
  ]);

  return { callSessionId: call.id };
}

// The traveler answers: a fixed, one-speaker script (disclosure already
// logged at dial time; here it's spoken, then the situation, then a
// sign-off) — no second persona, since this is an announcement, not a
// negotiation. Same streamed-transcript mechanics runCall.ts uses.
export async function answerTravelerCall(callSessionId: string): Promise<{ ok: boolean; outcome: string }> {
  const call = await CallSessions.get(callSessionId);
  if (!call) throw new Error('Call not found.');
  if (call.status !== 'dialing') return { ok: true, outcome: call.outcome || '' };

  const transcript: CallTurn[] = [];
  const emit = async (text: string, subStatus: string) => {
    const turn: CallTurn = { speaker: 'waypoint', text, at: Date.now() };
    transcript.push(turn);
    await CallSessions.update(call.id, { transcript, subStatus, status: 'in_progress' });
    await stream({ type: 'call_turn', turn, subStatus, callSessionId: call.id });
    await sleep(900);
  };

  await CallSessions.update(call.id, { status: 'connected', subStatus: 'Connecting' });
  await stream({ type: 'call_status', status: 'connected', subStatus: 'Connecting', callSessionId: call.id });
  await sleep(400);

  await emit(call.disclosureLine, 'Explaining the situation');
  await emit(call.context?.message || 'Wanted to give you a heads-up about your trip.', 'Explaining the situation');
  await emit("I'll pop the details up on your board right now so you can take a look.", 'Wrapping up');

  const outcome = 'Delivered the heads-up; the board has the full details.';
  await CallSessions.update(call.id, { status: 'ended', subStatus: 'Call ended', outcome, endedAt: Date.now() });
  await stream({ type: 'call_status', status: 'ended', subStatus: 'Call ended', outcome, callSessionId: call.id });
  await recordEvents(call.tripId, 'agent:disruption', [{ kind: 'call_ended', payload: { callSessionId: call.id, outcome } }]);

  return { ok: true, outcome };
}

// The one fallback path, shared by an explicit decline and the timeout sweep
// below: mark the call missed, and post the SAME content it would have said
// as a normal chat message. Never silent either way.
export async function missTravelerCall(callSessionId: string, reason: 'declined' | 'no_answer'): Promise<void> {
  const call = await CallSessions.get(callSessionId);
  if (!call || call.status !== 'dialing') return;
  const outcome = reason === 'declined' ? 'Traveler declined the call.' : "Traveler didn't pick up.";
  await CallSessions.update(callSessionId, { status: 'failed', subStatus: 'No answer', outcome, endedAt: Date.now() });
  await recordEvents(call.tripId, 'agent:disruption', [{ kind: 'call_ended', payload: { callSessionId, outcome } }]);
  await Messages.push({
    tripId: call.tripId,
    role: 'agent',
    text: call.context?.message || outcome,
    source: 'system',
    status: 'complete',
  });
}

// Called on a short interval (see backend/plugin.ts) — anything still
// ringing past the timeout genuinely wasn't answered, since there is no way
// to reach a closed tab in this app.
export async function sweepMissedCalls(): Promise<{ missed: number }> {
  const cutoff = Date.now() - RING_TIMEOUT_MS;
  const ringing = await CallSessions.filter(
    (c, $) => c.kind === $.kind && c.status === $.status && c.startedAt <= $.cutoff,
    { kind: 'to_traveler', status: 'dialing', cutoff }, // bindings: lifts closure vars so filter compiles to SQL
  );
  for (const c of ringing) await missTravelerCall(c.id, 'no_answer');
  return { missed: ringing.length };
}
