import { auth } from '@mindstudio-ai/agent';
import { assertTripAccess } from './common/collaborators';
import { buildIcs, buildWalletPreview } from './common/passGenerator';

function toDataUrl(mimeType: string, content: string): string {
  return `data:${mimeType};base64,${Buffer.from(content, 'utf8').toString('base64')}`;
}

// Generated on demand, nothing persisted — see common/passGenerator.ts for
// why that's enough to satisfy "updates in place" on a rebook for free.
export async function getNodeWalletFiles(input: { tripId: string; nodeId: string }) {
  const userId = auth.userId;
  if (!userId) throw new Error('Please sign in.');
  const access = await assertTripAccess(input.tripId, userId);
  const node = access.trip.nodes.find((n) => n.id === input.nodeId);
  if (!node) throw new Error('That item is no longer on the board.');
  if (node.status !== 'confirmed') throw new Error('Only confirmed items have a pass or calendar event yet.');

  return {
    icsDataUrl: toDataUrl('text/calendar', buildIcs(node, access.trip)),
    passPreviewDataUrl: toDataUrl('text/html', buildWalletPreview(node, access.trip)),
  };
}
