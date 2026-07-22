import { db } from '@mindstudio-ai/agent';

// A parsed document that couldn't be turned into a board node outright —
// missing a critical field (e.g. no checkout date) or ambiguous about which
// trip it belongs to. Mirrors pendingActions' spirit: the orchestrator only
// ever creates 'pending' rows; resolveImport.ts is the sole path that
// completes one, folding the traveler's answer into the draft and then
// running the same node-creation step importPipeline.ts uses for a clean parse.
export interface PendingImport {
  tripId: string | null;
  userId: string;
  rawExtract: string;
  draft: Record<string, any>;
  missingFields: string[];
  question: string;
  status: 'pending' | 'resolved' | 'expired';
}

export const PendingImports = db.defineTable<PendingImport>('pending_imports');
