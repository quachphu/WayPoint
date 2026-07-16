import { db } from '@mindstudio-ai/agent';
import type { RequestedBy } from '../common/types';

// The confirm-gate state machine. The orchestrator only ever creates 'pending'
// rows. approveAction is the ONLY path that executes the underlying booking/call,
// and it hard-refuses unless status === 'pending'. This is the code-level gate.
export interface PendingAction {
  tripId: string;
  nodeId: string | null;
  kind: 'book_flight' | 'book_hotel' | 'book_activity' | 'place_call' | 'rebook';
  summary: string; // exact plain-language action, used verbatim by the gate card + voice read-back
  payload: Record<string, any>; // everything the execution step needs
  status: 'pending' | 'approved' | 'executed' | 'declined' | 'expired';
  resolvedAt: number | null;
  requestedBy?: RequestedBy | null; // set when a companion (not the owner) asked
}

export const PendingActions = db.defineTable<PendingAction>('pending_actions');
