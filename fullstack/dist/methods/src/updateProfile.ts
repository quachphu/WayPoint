import { auth, mindstudio } from '@mindstudio-ai/agent';
import { Users, type User, type Gender } from './tables/users';

// A short, warm "I just read your profile" line from the mascot, generated
// fresh per traveler so it never feels templated — naturally references a
// couple of the specific things they shared instead of listing everything.
async function generateWelcomeMessage(u: User): Promise<string> {
  const name = (u.displayName || 'traveler').split(' ')[0];
  const facts: string[] = [];
  if (u.hobbies?.length) facts.push(`hobbies: ${u.hobbies.join(', ')}`);
  if (u.profession) facts.push(`profession: ${u.profession}`);
  if (u.favoriteGames?.length) facts.push(`favorite games: ${u.favoriteGames.join(', ')}`);
  if (u.favoriteMusic?.length) facts.push(`favorite music: ${u.favoriteMusic.join(', ')}`);
  if (u.languages?.length) facts.push(`speaks: ${u.languages.join(', ')}`);

  const prompt = `You are Waypoint, a warm and genuinely curious AI travel companion mascot. A new traveler named ${name} just finished setting up their profile. Here's what they shared — ${facts.join('; ') || 'not much detail yet'}.

Write ONE short, warm sentence (18-28 words) as if you just read their profile and are delighted to know them a little better. Naturally reference one or two specific details from what they shared — don't list everything, don't sound like a template, make it feel genuinely different each time. No emoji, no quotation marks, plain sentence only, addressed to them directly.`;

  try {
    const { content } = await mindstudio.generateText({
      message: prompt,
      modelOverride: { model: 'gemini-3-flash', temperature: 0.95, maxResponseTokens: 200 },
    } as any);
    return content.trim().replace(/^["']|["']$/g, '');
  } catch (err) {
    console.error('[profile] welcome message generation failed:', err);
    return `Loved learning a bit about you, ${name}.`;
  }
}

// Update the traveler profile. email and roles are platform-managed and never
// written here. Call consent is captured with a timestamp. Gender is locked
// once set — it picks the default avatar and shouldn't silently change out
// from under a display choice the traveler already made.
export async function updateProfile(input: {
  displayName?: string;
  homeAirport?: string;
  phone?: string;
  preferences?: User['preferences'];
  callConsent?: boolean;
  gender?: Gender;
  dateOfBirth?: string;
  hobbies?: string[];
  profession?: string;
  favoriteGames?: string[];
  favoriteMusic?: string[];
  languages?: string[];
  photoUrl?: string | null;
  profileComplete?: boolean;
}) {
  const userId = auth.userId;
  if (!userId) throw new Error('Please sign in.');
  const existing = await Users.get(userId);

  const patch: Partial<User> = {};
  if (input.displayName !== undefined) patch.displayName = input.displayName;
  if (input.homeAirport !== undefined) patch.homeAirport = input.homeAirport.toUpperCase();
  if (input.phone !== undefined) patch.phone = input.phone;
  if (input.preferences !== undefined) patch.preferences = input.preferences;
  if (input.callConsent !== undefined) {
    patch.callConsent = input.callConsent;
    patch.callConsentAt = input.callConsent ? Date.now() : undefined;
  }
  if (input.gender !== undefined && !existing?.gender) patch.gender = input.gender;
  if (input.dateOfBirth !== undefined) patch.dateOfBirth = input.dateOfBirth;
  if (input.hobbies !== undefined) patch.hobbies = input.hobbies;
  if (input.profession !== undefined) patch.profession = input.profession;
  if (input.favoriteGames !== undefined) patch.favoriteGames = input.favoriteGames;
  if (input.favoriteMusic !== undefined) patch.favoriteMusic = input.favoriteMusic;
  if (input.languages !== undefined) patch.languages = input.languages;
  if (input.photoUrl !== undefined) patch.photoUrl = input.photoUrl ?? undefined;
  if (input.profileComplete !== undefined) patch.profileComplete = input.profileComplete;

  const user = await Users.update(userId, patch);

  // Only the very first time onboarding completes — not on later profile edits.
  const justCompleted = input.profileComplete === true && !existing?.profileComplete;
  const welcomeMessage = justCompleted ? await generateWelcomeMessage(user) : undefined;

  return { user, welcomeMessage };
}
