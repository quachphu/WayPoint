import { auth } from '@mindstudio-ai/agent';
import { pollAndImport } from './common/mailInbox';

// Manual trigger for the same poll the background interval runs every
// ~60s — lets testing/demoing check the inbox immediately instead of waiting.
export async function checkImportInbox() {
  if (!auth.userId) throw new Error('Please sign in.');
  return pollAndImport();
}
