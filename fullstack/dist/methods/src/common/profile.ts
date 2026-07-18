import type { User } from '../tables/users';

// Age in whole years as of today, from an ISO "YYYY-MM-DD" date of birth.
export function ageFromDob(dob?: string): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const monthDiff = now.getMonth() - d.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

export function isBirthdayToday(dob?: string): boolean {
  if (!dob) return false;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  return now.getMonth() === d.getMonth() && now.getDate() === d.getDate();
}

function normalizeTag(s: string): string {
  return s.trim().toLowerCase();
}

// How many hobbies/games/music/languages two profiles have in common. Used to
// flag "Recommended" in People Nearby — never to filter anyone out.
export function sharedInterestCount(a: User, b: User): number {
  const setOf = (u: User) =>
    new Set([...(u.hobbies ?? []), ...(u.favoriteGames ?? []), ...(u.favoriteMusic ?? []), ...(u.languages ?? [])].map(normalizeTag));
  const setA = setOf(a);
  const setB = setOf(b);
  let count = 0;
  for (const tag of setA) if (setB.has(tag)) count++;
  return count;
}
