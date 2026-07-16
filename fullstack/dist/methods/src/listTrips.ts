import { auth } from '@mindstudio-ai/agent';
import { tripSummary } from './common/trips';
import { listAccessibleTrips } from './common/collaborators';

export async function listTrips() {
  const userId = auth.userId;
  if (!userId) return { trips: [] };
  // Trips the traveler owns OR is an active companion on, newest first.
  const trips = await listAccessibleTrips(userId);
  return { trips: trips.map(tripSummary) };
}
