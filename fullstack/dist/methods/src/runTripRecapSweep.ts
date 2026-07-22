import { auth } from '@mindstudio-ai/agent';
import { sweepTripsForRecap } from './common/tripRecap';

// Manual trigger for the same sweep the background interval runs every
// 30 minutes — same reasoning as checkImportInbox.ts: testing/demoing
// shouldn't need to wait out the interval.
export async function runTripRecapSweep() {
  if (!auth.userId) throw new Error('Please sign in.');
  await sweepTripsForRecap();
  return { ok: true };
}
