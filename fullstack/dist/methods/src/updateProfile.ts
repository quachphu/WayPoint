import { auth } from '@mindstudio-ai/agent';
import { Users, type User } from './tables/users';

// Update the traveler profile. email and roles are platform-managed and never
// written here. Call consent is captured with a timestamp.
export async function updateProfile(input: {
  displayName?: string;
  homeAirport?: string;
  phone?: string;
  preferences?: User['preferences'];
  callConsent?: boolean;
}) {
  const userId = auth.userId;
  if (!userId) throw new Error('Please sign in.');

  const patch: Partial<User> = {};
  if (input.displayName !== undefined) patch.displayName = input.displayName;
  if (input.homeAirport !== undefined) patch.homeAirport = input.homeAirport.toUpperCase();
  if (input.phone !== undefined) patch.phone = input.phone;
  if (input.preferences !== undefined) patch.preferences = input.preferences;
  if (input.callConsent !== undefined) {
    patch.callConsent = input.callConsent;
    patch.callConsentAt = input.callConsent ? Date.now() : undefined;
  }

  const user = await Users.update(userId, patch);
  return { user };
}
