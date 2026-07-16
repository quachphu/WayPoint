import { auth } from '@mindstudio-ai/agent';
import { extractTripMeta, createTripForUser } from './common/trips';

// Explicit trip creation. The common path is that `converse` creates a trip on
// the first utterance, so this is mostly for a bare "new trip" entry point.
export async function createTrip(input: { text?: string }) {
  const userId = auth.userId;
  if (!userId) throw new Error('Please sign in.');
  const meta = input.text
    ? await extractTripMeta(input.text)
    : { title: 'New trip', destination: '', origin: undefined, startDate: null, endDate: null };
  const trip = await createTripForUser(userId, meta);
  return { trip };
}
