import { auth } from '@mindstudio-ai/agent';
import { Users } from './tables/users';

// Permanently removes the caller's own login credentials and profile row.
// Deliberately scoped to identity data only — trips/messages the traveler
// created or collaborated on are left as historical record (a shared trip
// could still matter to the other people on it), not cascade-deleted.
export async function deleteAccount() {
  const userId = auth.userId;
  if (!userId) throw new Error('Please sign in.');
  await auth.deleteAccount();
  await Users.remove(userId);
  return { ok: true };
}
