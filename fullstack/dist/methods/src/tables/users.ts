import { db } from '@mindstudio-ai/agent';

export type Gender = 'male' | 'female' | 'lgbtq+';

// Auth table + traveler profile. email and roles are platform-managed.
// All other columns are optional until onboarding fills them.
export interface User {
  email: string;
  roles: string[];
  displayName?: string;
  phone?: string; // E.164
  homeAirport?: string; // IATA
  preferences?: {
    seat?: 'window' | 'aisle';
    nonstopPreferred?: boolean;
    hotelStyle?: string;
    notes?: string;
  };
  callConsent?: boolean;
  callConsentAt?: number; // unix ms
  // Captured client-side (browser geolocation, reverse-geocoded) on each
  // sign-in so location-based discovery (people nearby) stays current.
  location?: {
    city?: string;
    region?: string; // state/province
    country?: string;
    // ISO 3166-1 alpha-2, from the geocoder's own code field — "people
    // nearby" country matching keys off this, not the display name, since
    // different providers phrase the same country differently ("United
    // States" vs "United States of America"), which silently broke
    // matching between two people in the same country.
    countryCode?: string;
    lat?: number;
    lng?: number;
    updatedAt: number;
  };
  // Social profile, filled in during onboarding right after signup. Gender
  // picks the default avatar (male/female/lgbtq+ each map to a stock image)
  // until a custom photo upload exists, and is locked once set (see
  // updateProfile.ts). `profileComplete` gates whether the onboarding
  // screen shows again on the next sign-in.
  gender?: Gender;
  dateOfBirth?: string; // ISO date, e.g. "1998-05-14"
  hobbies?: string[]; // feeds Grok's trending-places personalization too
  profession?: string;
  favoriteGames?: string[];
  favoriteMusic?: string[];
  languages?: string[];
  photoUrl?: string; // data URI of a self-uploaded photo; absent = use the gender default
  profileComplete?: boolean;
  // Opt-in, default off — "The Trip Recap": a generated shareable summary
  // posted to the trip's chat a day or two after it wraps up. Never a
  // surprise, so it's gated on this rather than sent automatically.
  recapOptIn?: boolean;
}

export const Users = db.defineTable<User>('users');
