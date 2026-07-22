import { CallSessions } from '../tables/callSessions';

// A real Vocal Bridge limit would exist even for real calls (src/disruption.md);
// the simulated path honors the same guard for realism and so a testing loop
// can't blow through it. Enforced only on calls Waypoint places on its own
// initiative (the proactive traveler call) — a call the traveler explicitly
// approved through the confirm-gate is not blocked by this.
const DAILY_CALL_CAP = 3;

export async function underDailyCallCap(userId: string): Promise<boolean> {
  const since = Date.now() - 24 * 60 * 60 * 1000;
  const recent = await CallSessions.filter(
    (c, $) => c.userId === $.userId && c.startedAt >= $.since,
    { userId, since }, // bindings: lifts closure vars so filter compiles to SQL
  );
  return recent.length < DAILY_CALL_CAP;
}
