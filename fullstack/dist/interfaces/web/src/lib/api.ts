import { createClient, platform, auth, analytics, type InvokeOptions } from '@mindstudio-ai/interface';
import type {
  Bootstrap,
  TripBundle,
  Trip,
  TripSummary,
  User,
  SyncResult,
  RosterMember,
  InviteResult,
} from './types';

type Opts = InvokeOptions;

export const api = createClient<{
  getBootstrap(): Promise<Bootstrap>;
  listTrips(): Promise<{ trips: TripSummary[] }>;
  getTrip(input: { tripId: string }): Promise<TripBundle>;
  createTrip(input: { text?: string }): Promise<{ trip: Trip }>;
  updateProfile(input: {
    displayName?: string;
    homeAirport?: string;
    phone?: string;
    preferences?: User['preferences'];
    callConsent?: boolean;
  }): Promise<{ user: User }>;
  converse(
    input: { tripId?: string; text: string; source?: 'voice' | 'chat'; focusNodeId?: string | null },
    opts?: Opts,
  ): Promise<{ tripId: string; created: boolean; reply: string; version: number; trip: Trip }>;
  approveAction(
    input: { actionId: string },
    opts?: Opts,
  ): Promise<{ ok: boolean; kind: string; callSessionId?: string; tripId: string; version?: number; trip?: Trip }>;
  declineAction(input: { actionId: string }): Promise<{ ok: boolean; actionId: string }>;
  reportDisruption(
    input: { tripId: string; nodeId?: string; description?: string },
    opts?: Opts,
  ): Promise<{ ok: boolean; message: string; tripId: string; version: number; trip: Trip }>;
  runCall(
    input: { tripId: string; callSessionId: string },
    opts?: Opts,
  ): Promise<{ ok: boolean; outcome: string; callSessionId: string; actionId: string | null; tripId: string; version: number }>;
  // Shared trips
  createInvite(input: { tripId: string; email: string }): Promise<InviteResult>;
  claimInvite(input: { inviteToken: string }): Promise<TripBundle & { ok: boolean; tripId: string; roster: RosterMember[] }>;
  syncTrip(input: { tripId: string; sinceVersion?: number; focusNodeId?: string | null }): Promise<SyncResult>;
  setApproval(input: { tripId: string; collaboratorId: string; canApprove: boolean }): Promise<{ ok: boolean; roster: RosterMember[] }>;
  removeCollaborator(input: { tripId: string; collaboratorId: string }): Promise<{ ok: boolean; roster: RosterMember[] }>;
}>();

export { platform, auth, analytics };
