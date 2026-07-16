import { db } from '@mindstudio-ai/agent';

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
}

export const Users = db.defineTable<User>('users');
