import { db } from '@mindstudio-ai/agent';

export interface CallTurn {
  speaker: 'waypoint' | 'venue';
  text: string;
  at: number; // unix ms
}

// A first-class, audited record of every outbound call: the hardcoded disclosure
// it opened with, the full two-sided transcript, the outcome, and the consent basis.
// This table IS the call audit log the compliance spec requires.
export interface CallSession {
  tripId: string;
  nodeId: string;
  // Who Waypoint is calling — an explicit tag rather than string-matching on
  // `target`, since "Waypoint Calls You" reuses this same table for calls to
  // the traveler themselves, not just a venue on their behalf.
  kind: 'to_venue' | 'to_traveler';
  userId: string; // whose consent/rate-limit this call is placed against
  target: string; // "Delta Air Lines rebooking desk"
  goal: string; // "Rebook the delayed SFO to LAX leg"
  disclosureLine: string; // the exact hardcoded disclosure spoken first, verbatim
  status: 'dialing' | 'connected' | 'in_progress' | 'ended' | 'failed';
  subStatus: string; // live "what the agent is attempting"
  transcript: CallTurn[];
  outcome: string | null;
  consentBasis: string;
  context: Record<string, any>; // re-shop facts the call needs: carrier, route, alternatives, originalOffer, nodeId
  startedAt: number;
  endedAt: number | null;
}

export const CallSessions = db.defineTable<CallSession>('call_sessions');
