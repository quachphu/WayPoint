import { auth } from '@mindstudio-ai/agent';
import { resolvePendingImport } from './common/importPipeline';

// Answers the one clarifying question importDocument (or the mail poller)
// left open — a missing field, or which trip an ambiguous import belongs to.
export async function resolveImport(input: { importId: string; answer: string }) {
  const userId = auth.userId;
  if (!userId) throw new Error('Please sign in.');
  if (!input.importId || !input.answer?.trim()) throw new Error('Nothing to resolve.');
  return resolvePendingImport(input.importId, input.answer.trim());
}
