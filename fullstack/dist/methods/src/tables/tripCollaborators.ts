import { db } from '@mindstudio-ai/agent';

// One row per person-on-a-trip, plus one row per outstanding invite.
// The owner's row is created at trip creation; companion rows are created as
// invites (userId null, status 'invited') and claimed on sign-in.
export interface TripCollaborator {
  tripId: string;
  userId: string | null; // set once the person claims their spot
  email: string; // lowercased + trimmed, for invite matching
  role: 'owner' | 'companion';
  canApprove: boolean; // may clear a confirm-gate? owner always true
  presenceColor: string; // hex from the fixed palette, assigned on join
  status: 'invited' | 'active';
  invitedByName: string | null;
  inviteToken: string | null; // unguessable; the shareable link carries it
  focusNodeId: string | null; // board node this person is looking at
  lastSeenAt: number | null; // unix ms of most recent activity
}

export const TripCollaborators = db.defineTable<TripCollaborator>('trip_collaborators', {
  // One membership row per (trip, email). Lets invite re-sends upsert cleanly.
  unique: [['tripId', 'email']],
  defaults: {
    canApprove: false,
    status: 'invited',
    focusNodeId: null,
    lastSeenAt: null,
    invitedByName: null,
    inviteToken: null,
  },
});
